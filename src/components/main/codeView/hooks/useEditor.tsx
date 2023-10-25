import * as parse5 from "parse5";
import { useContext, useRef, useState, useEffect, useCallback } from "react";
import { IPosition, editor } from "monaco-editor";
import {
  MainContext,
  navigatorSelector,
  setCurrentFileContent,
} from "@_redux/main";
import morphdom from "morphdom";
import { DefaultTabSize, RootNodeUid } from "@_constants/main";
import { TNode, TNodeTreeData, TNodeUid } from "@_node/types";
import { getSubNodeUidsByBfs } from "@_node/apis";
import { THtmlNodeData, checkValidHtml, parseHtml } from "@_node/html";
import { getPositionFromIndex } from "@_services/htmlapi";
import { CodeSelection } from "../types";
import { getLineBreaker } from "@_services/global";
import { TCodeChange } from "@_types/main";
import { TFileNodeData } from "@_node/file";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { styles } from "@_components/main/stageView/iFrame/styles";
import { debounce } from "lodash";

function getLanguageFromExtension(extension: string) {
  switch (extension) {
    case ".html":
      return "html";
    case ".md":
      return "markdown";
    case ".js":
      return "javascript";
    case ".css":
      return "css";
    default:
      return "plaintext";
  }
}

export default function useEditor() {
  const [language, setLanguage] = useState("html");
  const {
    tabSize,
    setTabSize,
    codeEditing,
    setCodeEditing,
    ffTree,
    setActivePanel,
    addRunningActions,
    setUpdateOpt,
    setFSPending,
    setFFTree,
    setMonacoEditorRef,
    setNodeTree,
  } = useContext(MainContext);
  const { file } = useSelector(navigatorSelector);

  const dispatch = useDispatch();

  const [focusedNode, setFocusedNode] = useState<TNode>();
  const wordWrap: editor.IEditorOptions["wordWrap"] = "off";

  const editorConfigs = {
    contextmenu: true,
    tabSize,
    wordWrap,
    minimap: { enabled: false },
    automaticLayout: true,
    selectionHighlight: false,
  };
  const codeContentRef = useRef<string>("");

  const [codeContent, setCodeContent] = useState<string>("");

  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const codeChangeDecorationRef = useRef<
    Map<TNodeUid, editor.IModelDeltaDecoration[]>
  >(new Map<TNodeUid, editor.IModelDeltaDecoration[]>());
  const validNodeTreeRef = useRef<TNodeTreeData>({});
  const decorationCollectionRef = useRef<editor.IEditorDecorationsCollection>();
  const currentPosition = useRef<IPosition | null>(null);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    monacoRef.current = editor;
    setMonacoEditorRef(editor);

    setUpdateOpt({ parse: true, from: "file" });
    editor.onDidChangeCursorPosition((event) => {
      setTimeout(() => {
        if (event.reason === 2) {
          currentPosition.current &&
            monacoRef.current?.setPosition(currentPosition.current);
        }
      }, 0);
    });
    decorationCollectionRef.current = editor.createDecorationsCollection();
  };

  const updateLanguage = (extension: string) => {
    const language = getLanguageFromExtension(extension);
    setLanguage(language);
  };

  function getCurrentEditorInstance() {
    return monacoRef.current;
  }

  function getCodeChangeDecorationInstance() {
    return codeChangeDecorationRef.current;
  }

  function getValidNodeTreeInstance() {
    return validNodeTreeRef;
  }
  // panel focus handler
  function onPanelClick() {
    setActivePanel("code");
  }

  function findNodeBySelection(
    selection: CodeSelection,
    validNodeTree: TNodeTreeData,
  ): TNode | null {
    let focusedNode: TNode | null = null;
    if (selection) {
      let _uid: TNodeUid = "";
      const uids = getSubNodeUidsByBfs(RootNodeUid, validNodeTree);
      uids.reverse();
      for (const uid of uids) {
        const node = validNodeTree[uid];
        const sourceCodeLocation = node.sourceCodeLocation;

        if (!sourceCodeLocation) {
          continue;
        }

        let {
          startLine: startLineNumber,
          startCol: startColumn,
          endCol: endColumn,
          endLine: endLineNumber,
        } = sourceCodeLocation;

        const containFront =
          selection.startLineNumber === startLineNumber
            ? selection.startColumn > startColumn
            : selection.startLineNumber > startLineNumber;
        const containBack =
          selection.endLineNumber === endLineNumber
            ? selection.endColumn < endColumn
            : selection.endLineNumber < endLineNumber;

        if (containFront && containBack) {
          _uid = uid;
          break;
        }
      }
      if (_uid !== "") {
        const node = validNodeTree[_uid];
        focusedNode = structuredClone(node);
      }
    }
    return focusedNode;
  }

  const debouncedEditorUpdate = useCallback(
    debounce((value: string) => {
      const monacoEditor = getCurrentEditorInstance();
      if (!monacoEditor) return;
      const iframe: any = document.getElementById("iframeId");
      const iframeDoc = iframe.contentDocument;
      const iframeHtml = iframeDoc.getElementsByTagName("html")[0];
      const { htmlDom, tree } = parseHtml(value, false, "");

      let bodyEle = null;
      if (!htmlDom) return;
      const defaultTreeAdapter = parse5.defaultTreeAdapter;
      // bodyEle = DomUtils.getInnerHTML(htmlDom);

      const bodyNode = defaultTreeAdapter
        .getChildNodes(htmlDom)
        .filter(defaultTreeAdapter.isElementNode)[0];

      if (bodyNode) {
        bodyEle = parse5.serialize(bodyNode);
      }
      if (!iframeHtml || !bodyEle) return;

      try {
        morphdom(iframeHtml, bodyEle, {
          onBeforeElUpdated: function (fromEl, toEl) {
            if (fromEl.isEqualNode(toEl)) {
              return false;
            } else {
              //check if the node is a custom element
              if (toEl.nodeName.includes("-")) {
                //copy the content or template of the custom element
                toEl.innerHTML = fromEl.innerHTML;
              }
              //check if the node is html
              if (toEl.nodeName === "HTML") {
                //copy the attributes
                for (let i = 0; i < fromEl.attributes.length; i++) {
                  toEl.setAttribute(
                    fromEl.attributes[i].name,
                    fromEl.attributes[i].value,
                  );
                }
              }
            }
            return true;
          },
        });
        codeContentRef.current = value;
        setNodeTree(tree);

        dispatch(setCurrentFileContent(codeContentRef.current));
        setFSPending(false);
        const _file = structuredClone(ffTree[file.uid]) as TNode;
        addRunningActions(["processor-updateOpt"]);
        const fileData = _file.data as TFileNodeData;
        (ffTree[file.uid].data as TFileNodeData).content =
          codeContentRef.current;
        (ffTree[file.uid].data as TFileNodeData).contentInApp =
          codeContentRef.current;
        (ffTree[file.uid].data as TFileNodeData).changed =
          codeContentRef.current !== fileData.orgContent;
        setFFTree(ffTree);
        dispatch(setCurrentFileContent(codeContentRef.current));
        codeChangeDecorationRef.current.clear();
        setCodeEditing(false);
        setFSPending(false);
      } catch (e) {
        console.log(e);
      }
      const headNode = iframeDoc?.head;

      // add rnbw css
      const style = iframeDoc.createElement("style");
      style.textContent = styles;
      headNode.appendChild(style);
      setCodeEditing(false);
    }, 1000),
    [],
  );

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    debouncedEditorUpdate(value);
    setCodeEditing(true);
  };

  function updateFileContentOnRedux(
    value: string | undefined,
    monacoEditor: editor.IStandaloneCodeEditor | undefined,
    reduxTimeout: NodeJS.Timeout | null,
    saveFileContentToRedux: () => void,
    currentPosition: React.MutableRefObject<IPosition | null>,
    delay: number,
    setCodeEditing: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    codeContentRef.current = value || "";
    const newPosition = monacoEditor?.getPosition();
    if (newPosition !== undefined) {
      currentPosition.current = newPosition;
    }

    reduxTimeout !== null && clearTimeout(reduxTimeout);
    let updatedTimeout = setTimeout(saveFileContentToRedux, delay);
    setCodeEditing(true);
    return updatedTimeout;
  }

  // tabSize
  useEffect(() => {
    setTabSize(DefaultTabSize);
  }, []);

  return {
    getCurrentEditorInstance,
    getCodeChangeDecorationInstance,
    getValidNodeTreeInstance,
    decorationCollectionRef,
    currentPosition,
    handleEditorDidMount,
    language,
    updateLanguage,
    editorConfigs,
    findNodeBySelection,
    codeEditing,
    setCodeEditing,
    handleEditorChange,
    updateFileContentOnRedux,
    focusedNode,
    setFocusedNode,
    codeContent,
    setCodeContent,
  };
}

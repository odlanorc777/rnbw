import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import { debounce } from "lodash";
import { editor, KeyCode, KeyMod } from "monaco-editor";
import { useDispatch } from "react-redux";

import {
  CodeViewSyncDelay,
  CodeViewSyncDelay_Long,
  DefaultTabSize,
} from "@_constants/main";
import { MainContext } from "@_redux/main";
import { setCodeViewTabSize } from "@_redux/main/codeView";
import {
  setCurrentFileContent,
  setNeedToSelectCode,
} from "@_redux/main/nodeTree";
import { useAppState } from "@_redux/useAppState";

import { getCodeViewTheme, getLanguageFromExtension } from "../helpers";
import { TCodeSelection } from "../types";

const useEditor = () => {
  const dispatch = useDispatch();
  const { theme: _theme } = useAppState();
  const {
    monacoEditorRef,
    setMonacoEditorRef,
    isContentProgrammaticallyChanged,
    setIsContentProgrammaticallyChanged,
    setIsCodeTyping,

    onUndo,
    onRedo,
  } = useContext(MainContext);

  // set default tab-size
  useEffect(() => {
    dispatch(setCodeViewTabSize(DefaultTabSize));
  }, []);

  // theme
  const [theme, setTheme] = useState<"vs-dark" | "light">();
  useEffect(() => {
    setTheme(getCodeViewTheme(_theme));
  }, [_theme]);

  // language
  const [language, setLanguage] = useState("html");
  const updateLanguage = useCallback((extension: string) => {
    const language = getLanguageFromExtension(extension);
    setLanguage(language);
  }, []);

  // editor config variables
  const [wordWrap, setWordWrap] =
    useState<editor.IEditorOptions["wordWrap"]>("on");
  const editorConfigs: editor.IEditorConstructionOptions = useMemo(
    () => ({
      contextmenu: true,
      wordWrap,
      minimap: { enabled: false },
      automaticLayout: true,
      selectionHighlight: false,
      autoClosingBrackets: "always",
      autoIndent: "full",
      autoClosingQuotes: "always",
      autoClosingOvertype: "always",
      autoSurround: "languageDefined",
      codeLens: false,
      formatOnPaste: true,
      formatOnType: true,
      tabCompletion: "on",
    }),
    [wordWrap],
  );

  // code selection
  const [codeSelection, _setCodeSelection] = useState<TCodeSelection | null>(
    null,
  );
  const setCodeSelection = useCallback(() => {
    const monacoEditor = monacoEditorRef.current;
    const _selection = monacoEditor?.getSelection();
    _setCodeSelection(_selection ? _selection : null);
  }, []);

  // handlerEditorDidMount
  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneCodeEditor) => {
      setMonacoEditorRef(editor);

      //override monaco-editor undo/redo
      editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyZ, () =>
        setUndoRedoToggle((prev) => ({
          action: "undo",
          toggle: !prev.toggle,
        })),
      );
      editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ, () =>
        setUndoRedoToggle((prev) => ({
          action: "redo",
          toggle: !prev.toggle,
        })),
      );
      editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyY, () =>
        setUndoRedoToggle((prev) => ({
          action: "redo",
          toggle: !prev.toggle,
        })),
      );

      editor.onDidChangeCursorPosition((event) => {
        (event.source === "mouse" || event.source === "keyboard") &&
          setCodeSelection();
      });
    },
    [setCodeSelection],
  );

  // handleOnChange
  const onChange = useCallback(
    (value: string) => {
      dispatch(setCurrentFileContent(value));
      dispatch(
        setNeedToSelectCode(
          codeSelection
            ? {
                startLineNumber: codeSelection.startLineNumber,
                startColumn: codeSelection.startColumn,
                endLineNumber: codeSelection.endLineNumber,
                endColumn: codeSelection.endColumn,
              }
            : null,
        ),
      );
      setIsCodeTyping(false);
    },
    [codeSelection],
  );
  const debouncedOnChange = useCallback(
    debounce((value) => {
      onChange(value);
      setIsContentProgrammaticallyChanged(false);
    }, CodeViewSyncDelay),
    [onChange],
  );
  const longDebouncedOnChange = useCallback(
    debounce(onChange, CodeViewSyncDelay_Long),
    [onChange],
  );
  const handleOnChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;

      setIsCodeTyping(true);

      if (isContentProgrammaticallyChanged.current) {
        debouncedOnChange(value);
      } else {
        longDebouncedOnChange(value);
      }
    },
    [debouncedOnChange, longDebouncedOnChange],
  );

  // undo/redo
  const [undoRedoToggle, setUndoRedoToggle] = useState<{
    action: "none" | "undo" | "redo";
    toggle: boolean;
  }>({ action: "none", toggle: false });
  useEffect(() => {
    if (undoRedoToggle.action === "undo") {
      onUndo();
    } else if (undoRedoToggle.action === "redo") {
      onRedo();
    }
  }, [undoRedoToggle]);

  return {
    handleEditorDidMount,
    handleOnChange,

    theme,

    language,
    updateLanguage,

    editorConfigs,
    setWordWrap,

    codeSelection,
  };
};

export default useEditor;

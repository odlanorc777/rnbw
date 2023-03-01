import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import cx from 'classnames';
import {
  useDispatch,
  useSelector,
} from 'react-redux';
import { Panel } from 'react-resizable-panels';

import {
  SVGIconI,
  SVGIconII,
  SVGIconIII,
  TreeView,
} from '@_components/common';
import { TreeViewData } from '@_components/common/treeView/types';
import { RootNodeUid } from '@_constants/main';
import {
  addNode,
  copyNode,
  duplicateNode,
  getNodeChildIndex,
  moveNode,
  removeNode,
  replaceNode,
  sortNodeUidsByBfs,
  validateNodeUidCollection,
} from '@_node/index';
import {
  TNode,
  TNodeTreeData,
  TNodeUid,
} from '@_node/types';
import {
  collapseFNNode,
  expandFNNode,
  fnSelector,
  focusFNNode,
  getActionGroupIndexSelector,
  globalSelector,
  hmsInfoSelector,
  MainContext,
  navigatorSelector,
  selectFNNode,
  updateFNTreeViewState,
} from '@_redux/main';

import { NodeTreeViewProps } from './types';

export default function NodeTreeView(props: NodeTreeViewProps) {
  const dispatch = useDispatch()

  // main context
  const {
    // groupping action
    addRunningActions, removeRunningActions,

    // file tree view
    ffHoveredItem, setFFHoveredItem, ffHandlers, ffTree, setFFTree, updateFF,

    // ndoe tree view
    fnHoveredItem, setFNHoveredItem, nodeTree, setNodeTree, validNodeTree, setValidNodeTree,

    // update opt
    updateOpt, setUpdateOpt,

    // ff hms
    isHms, setIsHms, ffAction, setFFAction,

    // cmdk
    currentCommand, setCurrentCommand, cmdkOpen, setCmdkOpen, cmdkPages, setCmdkPages, cmdkPage,

    // global
    pending, setPending, messages, addMessage, removeMessage,

    // reference
    htmlReferenceData, cmdkReferenceData, cmdkReferenceJumpstart, cmdkReferenceActions, cmdkReferenceAdd,

    // active panel/clipboard
    activePanel, setActivePanel, clipboardData, setClipboardData,

    // os
    osType,

    // code view
    tabSize, setTabSize,

    // panel-resize
    panelResizing,
  } = useContext(MainContext)

  // redux state
  const actionGroupIndex = useSelector(getActionGroupIndexSelector)
  const { workspace, project, file } = useSelector(navigatorSelector)
  const { fileAction } = useSelector(globalSelector)
  const { futureLength, pastLength } = useSelector(hmsInfoSelector)
  // const { focusedItem, expandedItems, expandedItemsObj, selectedItems, selectedItemsObj } = useSelector(ffSelector)
  const { focusedItem, expandedItems, expandedItemsObj, selectedItems, selectedItemsObj } = useSelector(fnSelector)

  // -------------------------------------------------------------- Sync --------------------------------------------------------------
  // nodeTree -> validNodeTree
  useEffect(() => {
    const _nodeTree: TNodeTreeData = JSON.parse(JSON.stringify(nodeTree))
    const _validNodeTree: TNodeTreeData = {}

    let uids: TNodeUid[] = Object.keys(_nodeTree)
    uids = sortNodeUidsByBfs(uids)
    uids.reverse()
    uids.map((uid) => {
      const node = _nodeTree[uid]

      // validate
      if (node.children.length !== 0) {
        node.children = node.children.filter((c_uid) => {
          return _nodeTree[c_uid].data.valid
        })
        node.isEntity = (node.children.length === 0)
      }

      // add only validated node
      node.data.valid ? _validNodeTree[uid] = node : null
    })

    setValidNodeTree(_validNodeTree)
  }, [nodeTree])

  // validNodeTree -> nodeTreeViewData
  const nodeTreeViewData = useMemo(() => {
    let data: TreeViewData = {}
    for (const uid in validNodeTree) {
      const node = validNodeTree[uid]
      data[uid] = {
        index: node.uid,
        data: node,
        children: node.children,
        isFolder: !node.isEntity,
        canMove: uid !== RootNodeUid,
        canRename: uid !== RootNodeUid,
      }
    }
    return data
  }, [validNodeTree])

  // focusedItem -> scrollTo
  const focusedItemRef = useRef<TNodeUid>(focusedItem)
  useEffect(() => {
    // validate
    const node = validNodeTree[focusedItem]
    if (node === undefined) return

    // skip own state change
    if (focusedItemRef.current === focusedItem) {
      focusedItemRef.current = ''
      return
    }

    // scroll to focused item
    const focusedComponent = document.getElementById(`NodeTreeView-${focusedItem}`)
    setTimeout(() => focusedComponent?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }), 0)

    focusedComponent?.focus()
  }, [focusedItem])

  // node actions -> nodeTree
  const handleAddFNNode = useCallback((nodeType: string) => {
    // validate
    const focusedNode = validNodeTree[focusedItem]
    if (focusedNode === undefined) return

    // build the new node to add
    const tree = JSON.parse(JSON.stringify(nodeTree))
    let newNode: TNode = {
      uid: '',
      parentUid: focusedItem,
      name: nodeType,
      isEntity: true,
      children: [],
      data: {
        valid: true,
        isFormatText: false,

        type: 'tag',
        name: nodeType,
        data: undefined,
        attribs: {},

        // startLineNumber: '',
        // startColumn: '',
        // endLineNumber: '',
        // endColumn: '',

        // html: '',
      }
    }

    addRunningActions(['processor-nodeTree', 'processor-validNodeTree'])

    // add node
    const res = addNode(tree, focusedItem, newNode, osType, 'html', tabSize)
    setUpdateOpt({ parse: false, from: 'node' })
    setNodeTree(res.tree)
    dispatch(updateFNTreeViewState(res))
  }, [focusedItem, validNodeTree, nodeTree, osType, tabSize])
  const handleRemoveFNNode = useCallback(() => {
    // validate
    if (selectedItems.length === 0) return

    addRunningActions(['processor-nodeTree', 'processor-validNodeTree'])

    // remove the nodes
    const tree = JSON.parse(JSON.stringify(nodeTree))
    const res = removeNode(tree, selectedItems, 'html')
    setUpdateOpt({ parse: false, from: 'node' })
    setNodeTree(res.tree)
    dispatch(updateFNTreeViewState(res))
  }, [selectedItems, nodeTree])
  const handleDuplicateFNNode = useCallback(() => {
    // validate
    const uids = selectedItems.filter((uid) => uid !== RootNodeUid && validNodeTree[uid] !== undefined)
    if (uids.length === 0) return

    addRunningActions(['processor-nodeTree', 'processor-validNodeTree'])

    // duplicate the node
    const tree = JSON.parse(JSON.stringify(nodeTree))
    const res = duplicateNode(tree, uids, osType, 'html', tabSize)
    setUpdateOpt({ parse: false, from: 'node' })
    setNodeTree(res.tree)
    dispatch(updateFNTreeViewState(res))
  }, [selectedItems, validNodeTree, nodeTree, osType, tabSize])
  const _copy = useCallback((_uids: TNodeUid[], targetUid: TNodeUid, isBetween: boolean, position: number) => {
    // validate
    let uids: TNodeUid[] = [..._uids]
    uids = uids.filter((uid) => {
      return validNodeTree[uid] !== undefined
    })
    if (uids.length === 0 || validNodeTree[targetUid] === undefined) return

    addRunningActions(['processor-nodeTree', 'processor-validNodeTree'])

    // drop the nodes
    const tree = JSON.parse(JSON.stringify(nodeTree))
    const res = copyNode(tree, targetUid, isBetween, position, uids, osType, 'html', tabSize)
    setUpdateOpt({ parse: false, from: 'node' })
    setNodeTree(res.tree)
    dispatch(updateFNTreeViewState(res))
  }, [validNodeTree, nodeTree, osType, tabSize])
  const cb_renameNode = useCallback((uid: TNodeUid, newName: string) => {
    // validate
    const focusedNode = validNodeTree[uid]
    if (focusedNode === undefined || focusedNode.name === newName) return

    addRunningActions(['processor-nodeTree', 'processor-validNodeTree'])

    // rename the node
    const tree = JSON.parse(JSON.stringify(nodeTree))
    const node = { ...JSON.parse(JSON.stringify(tree[uid])), name: newName }
    replaceNode(tree, node)
    setUpdateOpt({ parse: false, from: 'node' })
    setNodeTree(tree)
  }, [validNodeTree, nodeTree])
  const cb_dropNode = useCallback((_uids: TNodeUid[], parentUid: TNodeUid, isBetween: boolean, position: number) => {
    // validate
    let uids: TNodeUid[] = []
    uids = validateNodeUidCollection(_uids, parentUid)
    uids = uids.filter((uid) => {
      return validNodeTree[uid] !== undefined
    })
    if (uids.length === 0 || validNodeTree[parentUid] === undefined) return

    addRunningActions(['processor-nodeTree', 'processor-validNodeTree'])

    // drop the nodes
    const tree = JSON.parse(JSON.stringify(nodeTree))
    const res = moveNode(
      tree,
      parentUid,
      isBetween,
      position,
      uids,
      osType,
      'html',
      tabSize,
    )
    setUpdateOpt({ parse: false, from: 'node' })
    setNodeTree(res.tree)
    dispatch(updateFNTreeViewState(res))
  }, [validNodeTree, nodeTree, osType, tabSize])

  // fn view state
  const cb_focusNode = useCallback((uid: TNodeUid) => {
    // for key-nav
    addRunningActions(['nodeTreeView-focus'])

    // validate
    if (focusedItem === uid || validNodeTree[uid] === undefined) {
      removeRunningActions(['nodeTreeView-focus'], false)
      return
    }

    focusedItemRef.current = uid
    dispatch(focusFNNode(uid))

    removeRunningActions(['nodeTreeView-focus'])
  }, [focusedItem, validNodeTree])
  const cb_selectNode = useCallback((uids: TNodeUid[]) => {
    // for key-nav
    addRunningActions(['nodeTreeView-select'])

    // validate
    let _uids = [...uids]
    _uids = validateNodeUidCollection(_uids)
    _uids = _uids.filter((_uid) => {
      return validNodeTree[_uid] !== undefined
    })

    // check if it's new state
    if (_uids.length === selectedItems.length) {
      let same = true
      for (const uid of uids) {
        if (selectedItemsObj[uid] === undefined) {
          same = false
          break
        }
      }
      if (same) {
        removeRunningActions(['nodeTreeView-select'], false)
        return
      }
    }

    dispatch(selectFNNode(_uids))

    removeRunningActions(['nodeTreeView-select'])
  }, [validNodeTree, selectedItems, selectedItemsObj])
  const cb_expandNode = useCallback((uid: TNodeUid) => {
    // for key-nav
    addRunningActions(['nodeTreeView-expand'])

    // validate
    const node = validNodeTree[uid]
    if (node === undefined || node.isEntity || expandedItemsObj[uid] === true) {
      removeRunningActions(['nodeTreeView-expand'], false)
      return
    }

    dispatch(expandFNNode([uid]))

    removeRunningActions(['nodeTreeView-expand'])
  }, [validNodeTree, expandedItemsObj])
  const cb_collapseNode = useCallback((uid: TNodeUid) => {
    // for key-nav
    addRunningActions(['nodeTreeView-collapse'])

    // validate
    const node = validNodeTree[uid]
    if (node === undefined || node.isEntity || expandedItemsObj[uid] === undefined) {
      removeRunningActions(['nodeTreeView-collapse'], false)
      return
    }

    dispatch(collapseFNNode([uid]))

    removeRunningActions(['nodeTreeView-collapse'])
  }, [validNodeTree, expandedItemsObj])
  // -------------------------------------------------------------- Sync --------------------------------------------------------------

  // -------------------------------------------------------------- Cmdk --------------------------------------------------------------
  // command detect & do actions
  useEffect(() => {
    if (activePanel !== 'node' && activePanel !== 'stage') return

    if (currentCommand.action === '') return

    switch (currentCommand.action) {
      case 'Actions':
        onActions()
        break
      case 'Add':
        onAdd()
        break
      case 'Cut':
        onCut()
        break
      case 'Copy':
        onCopy()
        break
      case 'Paste':
        onPaste()
        break
      case 'Delete':
        onDelete()
        break
      case 'Duplicate':
        onDuplicate()
        break
      case 'Turn into':
        onTurnInto()
        break
      case 'Group':
        onGroup()
        break
      case 'Ungroup':
        onUngroup()
        break
      default:
        onAddNode(currentCommand.action)
        break
    }
  }, [currentCommand.changed])

  // command handlers
  const onActions = useCallback(() => {
    if (cmdkOpen) return
    setCmdkPages(['Actions'])
    setCmdkOpen(true)
  }, [cmdkOpen])
  const onAdd = useCallback(() => {
    setCmdkPages([...cmdkPages, 'Add'])
    setCmdkOpen(true)
  }, [cmdkPages])
  const onCut = useCallback(() => {
    setClipboardData({ panel: 'node', type: 'cut', uids: selectedItems })
  }, [selectedItems])
  const onCopy = useCallback(() => {
    setClipboardData({ panel: 'node', type: 'copy', uids: selectedItems })
  }, [selectedItems])
  const onPaste = useCallback(() => {
    if (activePanel !== 'node' && activePanel !== 'stage') return
    if (clipboardData.panel !== 'node') return

    const focusedNode = validNodeTree[focusedItem]
    if (focusedNode === undefined) return
    const parentNode = validNodeTree[focusedNode.parentUid as TNodeUid]
    if (parentNode === undefined) return

    const childIndex = getNodeChildIndex(parentNode, focusedNode)

    if (clipboardData.type === 'cut') {
      setClipboardData({ panel: 'node', type: 'cut', uids: [] })
      cb_dropNode(clipboardData.uids, parentNode.uid, true, childIndex + 1)
    } else if (clipboardData.type === 'copy') {
      _copy(clipboardData.uids, parentNode.uid, true, childIndex + 1)
    }
  }, [activePanel, clipboardData, cb_dropNode, _copy, focusedItem, validNodeTree])
  const onDelete = useCallback(() => {
    handleRemoveFNNode()
  }, [handleRemoveFNNode])
  const onDuplicate = useCallback(() => {
    handleDuplicateFNNode()
  }, [handleDuplicateFNNode])
  const onTurnInto = useCallback(() => {
  }, [])
  const onGroup = useCallback(() => {
  }, [])
  const onUngroup = useCallback(() => {
  }, [])
  const onAddNode = useCallback((actionName: string) => {
    if (actionName.startsWith('AddNode-') === false) return

    const tagName = actionName.slice(9, actionName.length - 1)
    handleAddFNNode(tagName)
  }, [handleAddFNNode])
  // -------------------------------------------------------------- Cmdk --------------------------------------------------------------

  // -------------------------------------------------------------- other --------------------------------------------------------------
  // panel focus handler
  const onPanelClick = useCallback((e: React.MouseEvent) => {
    setActivePanel('node')
    return

    addRunningActions(['nodeTreeView-focus'])

    const uid = RootNodeUid

    // validate
    if (focusedItem === uid || validNodeTree[uid] === undefined) {
      removeRunningActions(['nodeTreeView-focus'], false)
      return
    }

    focusedItemRef.current = uid
    dispatch(selectFNNode([]))
    dispatch(focusFNNode(uid))

    removeRunningActions(['nodeTreeView-focus'])
  }, [focusedItem, validNodeTree])
  // -------------------------------------------------------------- other --------------------------------------------------------------

  return <>
    <Panel minSize={0}>
      <div
        id="NodeTreeView"
        className={cx(
          'scrollable',
          // (activePanel === 'node' && focusedItem === RootNodeUid) ? "outline outline-primary" : "",
        )}
        style={{
          // padding: '1px 1px 1rem',
          pointerEvents: panelResizing ? 'none' : 'auto',
        }}
        onClick={onPanelClick}
      >
        {/* Main TreeView */}
        <TreeView
          /* style */
          width={'100%'}
          height={'auto'}

          /* info */
          info={{ id: 'node-tree-view' }}

          /* data */
          data={nodeTreeViewData}
          focusedItem={focusedItem}
          expandedItems={expandedItems}
          selectedItems={selectedItems}

          /* renderers */
          renderers={{
            renderTreeContainer: (props) => {
              return <>
                <ul {...props.containerProps}>
                  {props.children}
                </ul>
              </>
            },
            renderItemsContainer: (props) => {
              return <>
                <ul {...props.containerProps}>
                  {props.children}
                </ul>
              </>
            },
            renderItem: (props) => {
              return <>
                <li
                  key={props.item.data.uid}
                  className={cx(
                    props.context.isSelected && 'background-secondary',

                    props.context.isDraggingOver && '',
                    props.context.isDraggingOverParent && '',

                    props.context.isFocused && '',
                  )}
                  {...props.context.itemContainerWithChildrenProps}
                >
                  {/* self */}
                  <div
                    id={`NodeTreeView-${props.item.index}`}
                    className={cx(
                      'justify-stretch',
                      'padding-xs',

                      'outline-default',

                      props.item.index === ffHoveredItem ? 'outline' : '',

                      props.context.isExpanded && props.context.isSelected && 'background-tertiary',
                      !props.context.isExpanded && props.context.isSelected && 'background-secondary',

                      props.context.isSelected && 'outline-none',
                      !props.context.isSelected && props.context.isFocused && 'outline',

                      props.context.isDraggingOver && '',
                      props.context.isDraggingOverParent && '',
                    )}
                    style={{
                      flexWrap: "nowrap",
                      paddingLeft: `${props.depth * 10}px`,
                    }}

                    {...props.context.itemContainerWithoutChildrenProps}
                    {...props.context.interactiveElementProps}
                    onClick={(e) => {
                      e.stopPropagation()

                      // group action
                      !props.context.isFocused && addRunningActions(['nodeTreeView-focus'])
                      addRunningActions(['nodeTreeView-select'])

                      removeRunningActions(['nodeTreeView-arrowClick'])

                      // call back
                      props.context.isFocused ? null : props.context.focusItem()

                      e.shiftKey ? props.context.selectUpTo() :
                        e.ctrlKey ? (props.context.isSelected ? props.context.unselectItem() : props.context.addToSelectedItems()) :
                          props.context.selectItem()
                    }}
                    onFocus={() => { }}
                    onMouseEnter={() => setFNHoveredItem(props.item.index as TNodeUid)}
                    onMouseLeave={() => setFNHoveredItem('')}
                  >
                    <div className="gap-xs padding-xs" style={{ width: "100%" }}>
                      {/* render arrow */}
                      {props.arrow}

                      {/* render icon */}
                      {props.item.isFolder ?
                        props.context.isExpanded ? <SVGIconI {...{ "class": "icon-xs" }}>div</SVGIconI> : <SVGIconII {...{ "class": "icon-xs" }}>div</SVGIconII> :
                        <SVGIconIII {...{ "class": "icon-xs" }}>component</SVGIconIII>}


                      {/* render title */}
                      {props.title}
                    </div>
                  </div>

                  {/* render children */}
                  {props.context.isExpanded ? <>
                    <div>
                      {props.children} {/* this calls the renderItemsContainer again */}
                    </div>
                  </> : null}
                </li>
              </>
            },
            renderItemArrow: (props) => {
              return <>
                {props.item.isFolder ?
                  (props.context.isExpanded ? <SVGIconI {...{
                    "class": "icon-xs", "onClick": (e: MouseEvent) => {
                      // to merge with the click event
                      addRunningActions(['nodeTreeView-arrowClick'])

                      addRunningActions([props.context.isExpanded ? 'nodeTreeView-collapse' : 'nodeTreeView-expand'])

                      // callback
                      props.context.toggleExpandedState()
                    }
                  }}>down</SVGIconI> : <SVGIconII {...{
                    "class": "icon-xs", "onClick": (e: MouseEvent) => {
                      // to merge with the click event
                      addRunningActions(['nodeTreeView-arrowClick'])

                      addRunningActions([props.context.isExpanded ? 'nodeTreeView-collapse' : 'nodeTreeView-expand'])

                      // callback
                      props.context.toggleExpandedState()
                    }
                  }}>right</SVGIconII>)
                  : <div
                    className='icon-xs'
                    onClick={(e) => {
                      // to merge with the click event
                      addRunningActions(['nodeTreeView-arrowClick'])
                    }}
                  >
                  </div>}
              </>
            },
            renderItemTitle: (props) => {
              return <>
                <span
                  className='text-s justify-stretch inline-label'
                  style={{
                    width: "calc(100% - 32px)"
                  }}
                >
                  {props.title}
                </span>
              </>
            },
            renderDragBetweenLine: ({ draggingPosition, lineProps }) => (
              <div
                {...lineProps}
                className={'foreground-tertiary'}
                style={{
                  position: 'absolute',
                  right: '0',
                  top:
                    draggingPosition.targetType === 'between-items' && draggingPosition.linePosition === 'top' ? '0px'
                      : draggingPosition.targetType === 'between-items' && draggingPosition.linePosition === 'bottom' ? '-4px'
                        : '-2px',
                  left: `${draggingPosition.depth * 10}px`,
                  height: '2px',
                }}
              />
            ),
          }}

          /* possibilities */
          props={{
            canDragAndDrop: true,
            canDropOnFolder: true,
            canDropOnNonFolder: true,
            canReorderItems: true,

            canSearch: false,
            canSearchByStartingTyping: false,
            canRename: false,
          }}

          /* cb */
          callbacks={{
            /* RENAME CALLBACK */
            onRenameItem: (item, name) => {
              cb_renameNode(item.index as TNodeUid, name)
            },

            /* SELECT, FOCUS, EXPAND, COLLAPSE CALLBACK */
            onSelectItems: (items) => {
              cb_selectNode(items as TNodeUid[])
            },
            onFocusItem: (item) => {
              cb_focusNode(item.index as TNodeUid)
            },
            onExpandItem: (item) => {
              cb_expandNode(item.index as TNodeUid)
            },
            onCollapseItem: (item) => {
              cb_collapseNode(item.index as TNodeUid)
            },

            // DnD CALLBACK
            onDrop: (items, target) => {
              // building drop-node-payload
              const uids: TNodeUid[] = items.map(item => item.index as TNodeUid)
              const isBetween = target.targetType === 'between-items'
              const parentUid = (isBetween ? target.parentItem : target.targetItem) as TNodeUid
              const position = isBetween ? target.childIndex : 0

              cb_dropNode(uids, parentUid, isBetween, position)
            }
          }}
        />
      </div>
    </Panel>
  </>
}
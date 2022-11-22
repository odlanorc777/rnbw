import {
  parseHtml,
  serializeHtml,
} from './html';
import {
  TAddNodePayload,
  TDuplicateNodePayload,
  TMoveNodePayload,
  TNode,
  TNodeApiRes,
  TParseFilePayload,
  TRemoveNodePayload,
  TReplaceNodePayload,
  TSearializeFilePayload,
  TTree,
  TUid,
} from './types';

/**
 * generate the new uid inside p_uid
 * @param p_uid 
 * @param nodeIndex 
 * @returns 
 */
export const generateNodeUid = (p_uid: TUid, nodeIndex: number): TUid => {
  return p_uid + "_" + nodeIndex
}

/**
 * get all of the nested chidren(not entity) uids
 * @param uid 
 * @param tree 
 * @returns 
 */
export const getSubNEUids = (uid: TUid, tree: TTree): TUid[] => {
  let subUids: TUid[] = [uid]
  let uids: TUid[] = []
  while (subUids.length) {
    const subUid = subUids.shift() as TUid
    uids.push(subUid)
    const node = tree[subUid]
    for (const childUid of node.children) {
      if (!tree[childUid].isEntity) {
        subUids.push(childUid)
      }
    }
  }
  return uids
}

/**
 * get all of the nested chidren uids
 * @param uid 
 * @param tree 
 * @returns 
 */
export const getSubUids = (uid: TUid, tree: TTree): TUid[] => {
  let subUids: TUid[] = [uid]
  let uids: TUid[] = []
  while (subUids.length) {
    const subUid = subUids.shift() as TUid
    uids.push(subUid)
    const node = tree[subUid]
    for (const childUid of node.children) {
      subUids.push(childUid)
    }
  }
  return uids
}

/**
 * reset all of the uids inside p_uid in the tree data
 * @param p_uid 
 * @param tree 
 * @param convertedUids 
 */
export const resetUids = (p_uid: TUid, tree: TTree, deletedUids: TUid[], convertedUids: Map<TUid, TUid>) => {
  const addedNodes: TNode[] = []
  const _deletedUids: TUid[] = []

  tree[p_uid].children = tree[p_uid].children.map((uid, index) => {
    const newUid = generateNodeUid(p_uid, index + 1)
    if (newUid !== uid) {
      /* remove original node(nest) and add new nodes */
      const subUids = getSubUids(uid, tree)
      _deletedUids.push(...subUids)
      for (const subUid of subUids) {
        const newSubUid = newUid + subUid.slice(uid.length)
        const subNode = tree[subUid]
        addedNodes.push({
          uid: newSubUid,
          p_uid: (subNode.p_uid !== p_uid) ? newUid + subNode.p_uid?.slice(uid.length) : p_uid,
          name: subNode.name,
          isEntity: subNode.isEntity,
          children: subNode.children.map(c_uid => newUid + c_uid.slice(uid.length)),
          data: subNode.data,
        })
        convertedUids.set(subUid, newSubUid)
      }
    }
    return newUid
  })

  /* delete orignal node-nest */
  for (const deletedUid of _deletedUids) {
    delete tree[deletedUid]
  }
  deletedUids.push(..._deletedUids)

  /* add the new renamed nodes */
  for (const addedNode of addedNodes) {
    tree[addedNode.uid] = addedNode
  }
}

/**
 * add node api
 * this api adds the node just child of the target node in the tree
 */
export const addNode = ({ tree, targetUid, node }: TAddNodePayload): TNodeApiRes => {
  try {
    const target = tree[targetUid]
    node.uid = generateNodeUid(targetUid, target.children.length + 1)
    node.p_uid = targetUid
    target.children.push(node.uid)
    tree[node.uid] = node

    return { success: true }
  } catch (err) {
    return { success: false, error: err as string }
  }
}

/**
 * remove node api
 * this api removes the nodes from the tree based on the node uids
 */
export const removeNode = ({ tree, nodeUids }: TRemoveNodePayload): TNodeApiRes => {
  try {
    const convertedUids = new Map<TUid, TUid>()
    const deletedUids: TUid[] = []
    const changedParent: { [uid: TUid]: boolean } = {}

    for (const nodeUid of nodeUids) {
      const node = tree[nodeUid]

      changedParent[node.p_uid as TUid] = true
      const p_node = tree[node.p_uid as TUid]
      p_node.children = p_node.children.filter(c_uid => c_uid !== nodeUid)

      /* remove sub nodes */
      const uids = getSubUids(nodeUid, tree)
      for (const uid of uids) {
        delete tree[uid]
      }
      deletedUids.push(...uids)
    }

    /* reset the uids */
    for (const uid in changedParent) {
      resetUids(uid, tree, deletedUids, convertedUids)
    }

    return { success: true, deletedUids, convertedUids }
  } catch (err) {
    return { success: false, error: err as string }
  }
}

/**
 * replace node api
 * this api replaces the node in the tree - it can also use for rename
 */
export const replaceNode = ({ tree, node }: TReplaceNodePayload): TNodeApiRes => {
  try {
    // replace node in the tree
    tree[node.uid] = node

    return { success: true }
  } catch (err) {
    return { success: false, error: err as string }
  }
}

/**
 * move(cut & paste) node api
 * this api moves the nodes inside the parent node
 */
export const moveNode = ({ tree, isBetween, parentUid, position, uids }: TMoveNodePayload): TNodeApiRes => {
  try {
    const convertedUids = new Map<TUid, TUid>()
    const deletedUids: TUid[] = []
    const changedParent: { [uid: TUid]: boolean } = {}

    const parentNode = tree[parentUid]
    for (const uid of uids) {
      const node = tree[uid]

      /* reset the parent node */
      const p_node = tree[node.p_uid as TUid]
      changedParent[p_node.uid] = true
      p_node.children = p_node.children.filter(c_uid => c_uid !== uid)

      if (isBetween) {
        /* get the correct position */
        let childIndex = position?.side === 'top' ? position?.childIndex : position?.childIndex as number + 1
        node.p_uid = parentUid

        /* push the node at the specific position of the parent.children */
        parentNode.children = parentNode.children.reduce((prev, cur, index) => {
          if (index === childIndex) {
            prev.push(uid)
          }
          prev.push(cur)
          return prev
        }, [] as TUid[])
      } else {
        /* push to back of the parent node */
        node.p_uid = parentUid
        parentNode.children.push(uid)
      }
    }

    /* reset the uids */
    for (const uid in changedParent) {
      resetUids(uid, tree, deletedUids, convertedUids)
    }
    resetUids(parentUid, tree, deletedUids, convertedUids)

    return { success: true, deletedUids, convertedUids }
  } catch (err) {
    return { success: false, error: err as string }
  }
}

/**
 * duplicate(copy & paste) node api
 * this api duplicates the nodes inside the parent node
 */
export const duplicateNode = ({ tree, node }: TDuplicateNodePayload): TNodeApiRes => {
  try {
    const convertedUids = new Map<TUid, TUid>()
    const deletedUids: TUid[] = []

    /* insert the duplicated node uid to the parent.children */
    const p_node = tree[node.p_uid as TUid]
    let newUid: TUid = node.uid
    p_node.children = p_node.children.reduce((prev, cur, index) => {
      prev.push(cur)
      if (cur === node.uid) {
        newUid = generateNodeUid(p_node.uid, index + 1)
        prev.push(newUid)
      }
      return prev
    }, [] as TUid[])

    /* generate the new nodes and add them to the tree */
    const subUids = getSubUids(node.uid, tree)
    for (const subUid of subUids) {
      const newSubUid = newUid + subUid.slice(node.uid.length)
      const subNode = tree[subUid]
      tree[newSubUid] = {
        uid: newSubUid,
        p_uid: (subNode.p_uid !== p_node.uid) ? newUid + subNode.p_uid?.slice(node.uid.length) : p_node.uid,
        name: subNode.name,
        isEntity: subNode.isEntity,
        children: subNode.children.map(c_uid => newUid + c_uid.slice(node.uid.length)),
        data: subNode.data,
      }
    }

    /* reset the node uids */
    resetUids(p_node.uid, tree, deletedUids, convertedUids)

    return { success: true, deletedUids, convertedUids }
  } catch (err) {
    return { success: false, error: err as string }
  }
}

/**
 * parse file api
 * this api parses the file content based on the type and return the tree data
 */
export const parseFile = ({ type, content }: TParseFilePayload): TTree => {
  if (type === "html") {
    return parseHtml(content)
  }
  return {}
}

/**
 * searialize file api
 * this api searializes the file content based on the type and tree data
 */
export const serializeFile = ({ type, tree }: TSearializeFilePayload): string => {
  if (type === "html") {
    return serializeHtml(tree)
  }
  return ''
}
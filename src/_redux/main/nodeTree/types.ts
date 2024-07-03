import { TNodeTreeData, TNodeUid } from "@_node/types";

import { TTreeViewState } from "../types";
import { TCodeSelection } from "@src/main/codeView";

export type TNodeTreeReducerState = {
  nodeTree: TNodeTreeData;
  validNodeTree: TNodeTreeData;

  needToSelectNodePaths: string[] | null;
  needToSelectCode: TCodeSelection | null;

  nodeTreeViewState: TTreeViewState;
  hoveredNodeUid: TNodeUid;
  copiedNodeDisplayName: string[];
};

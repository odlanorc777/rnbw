import { createSelector } from 'reselect';

import { AppState } from '@_redux/_root';

// workspace selector
const globalGetWorkspace = (state: AppState) => state.global.workspace
export const globalGetWorkspaceSelector = createSelector(globalGetWorkspace, (workspace) => workspace)

// pending selector
const globalGetPending = (state: AppState) => state.global.pending
export const globalGetPendingSelector = createSelector(globalGetPending, (pending) => pending)

// currentFile selector
const globalGetCurrentFile = (state: AppState) => state.global.currentFile
export const globalGetCurrentFileSelector = createSelector(globalGetCurrentFile, (currentFile) => currentFile)

// globalError selector
const globalGetError = (state: AppState) => state.global.error
export const globalGetErrorSelector = createSelector(globalGetError, (error) => error)
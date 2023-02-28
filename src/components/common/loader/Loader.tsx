import React from 'react';

import { LoaderProps } from './types';

export const Loader = (props: LoaderProps) => {
  return <>
    <div style={{position: "absolute", height: "2px", zIndex: "1" }} className="box-xl">
      <div className="loading-bar"></div>
    </div>
  </>
}
"use strict";(self.webpackChunkrainbow=self.webpackChunkrainbow||[]).push([[4246],{54246:function(e,t,r){r.r(t),r.d(t,{FileSystemWritableFileStream:function(){return o}});var i=r(29673);const s=globalThis.WritableStream||i.WritableStream;class o extends s{constructor(e,t){super(e,t),this._closed=!1,Object.setPrototypeOf(this,o.prototype)}close(){this._closed=!0;const e=this.getWriter(),t=e.close();return e.releaseLock(),t}seek(e){return this.write({type:"seek",position:e})}truncate(e){return this.write({type:"truncate",size:e})}write(e){if(this._closed)return Promise.reject(new TypeError("Cannot write to a CLOSED writable stream"));const t=this.getWriter(),r=t.write(e);return t.releaseLock(),r}}Object.defineProperty(o.prototype,Symbol.toStringTag,{value:"FileSystemWritableFileStream",writable:!1,enumerable:!1,configurable:!0}),Object.defineProperties(o.prototype,{close:{enumerable:!0},seek:{enumerable:!0},truncate:{enumerable:!0},write:{enumerable:!0}}),t.default=o}}]);
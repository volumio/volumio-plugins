/// <reference types="node" />

declare function streamEqual(stream1: NodeJS.ReadableStream, stream2: NodeJS.ReadableStream, cb: streamEqual.Cb): undefined;
declare function streamEqual(stream1: NodeJS.ReadableStream, stream2: NodeJS.ReadableStream): Promise<boolean>;

declare namespace streamEqual {
  export type Cb = (err: null|Error, equal: boolean) => void;
}

export= streamEqual;

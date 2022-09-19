import { Config } from './services/config';
import { NearUtils } from './services/near';

export interface RefFiViewFunctionOptions {
  methodName: string;
  args?: object;
}

export interface Context {
  ftViewFunction(
    tokenId: string,
    options: RefFiViewFunctionOptions
  ): Promise<any>;
  refFiViewFunction(options: RefFiViewFunctionOptions): Promise<any>;
  config: Config;
  nearUtils: NearUtils;
}

module default {
  abstract type Producible extending Resource, Mixin::Named {
    overloaded name {
      delegated constraint exclusive;
    };
    
    scriptureReferences: multirange<int32>;
  }
  
  type EthnoArt extending Producible;
  type Film extending Producible;
  type Story extending Producible;
}

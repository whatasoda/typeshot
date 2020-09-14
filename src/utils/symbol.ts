export const getSymbolName = (symbol: symbol): string => symbol.toString().slice(/* Symbol( */ 6, /* ) */ -1);

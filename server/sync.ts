import { synchronize } from "../src/application/synchronize.js";
import { ApplePriceSource } from "./infrastructure/apple.js";
import { FrankfurterSource } from "./infrastructure/frankfurter.js";
import { FileCatalogStore } from "./infrastructure/store.js";
const result = await synchronize(
  new FileCatalogStore(process.env.DATA_DIR ?? "./data"),
  new ApplePriceSource(),
  new FrankfurterSource(),
);
console.log(
  JSON.stringify(
    {
      products: result.products.length,
      comparable: result.products.filter((product) => product.kr && product.us)
        .length,
      exchangeRate: result.exchangeRate,
      issues: result.issues,
    },
    null,
    2,
  ),
);
if (!result.products.length || !result.exchangeRate) process.exitCode = 1;

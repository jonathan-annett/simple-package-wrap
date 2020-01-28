# simple-package-wrap

- wraps javascipt modules for browser/node.js loading with minimal overhead
- creates minified versions as well as debug versions of your package


when writing you module, export a single function that "returns" the ultimate export of the deployed module
(this means if you were to load your module for testing before packaging it, you'd need to invoke it as a function as in

    var myModule = require("./myfile.js")();

myfile.js
---

          module.exports = function () {
             // this is a wrapper for module. anything 'returned' becomes the exported module/function/object


              function myExportedFunction () {
                  console.log("i did something here");
              }

              return myExportedFunction;
          }


then 

**output**
myfile.pkg.js
---

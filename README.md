# simple-package-wrap

- wraps javascipt modules for browser/node.js loading with minimal overhead
- creates minified versions as well as debug versions of your package


example

myfile.js
---

     module.exports = function () {
        // this is a wrapper for module. anything 'returned' becomes the exported module/function/object


         function myExportedFunction () {
             console.log("i did something here");
         }

         return myExportedFunction;
     }



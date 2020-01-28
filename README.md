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



**in terminal**

    $ node --require ./index.js 
    Welcome to Node.js v12.14.1.
    Type ".help" for more information.
    > build("./sample.js","sample")
    detected exported function: 243 chars
    wrote: ./sample.pkg.js
    packaged source: 397 chars. minifying...
    wrote: ./sample.min.js
    final minifed source: 198 chars
    undefined

**creates files**


sample.pkg.js
---

    (function($N){$N[0][$N[1]]=(function(){$N=!!$N[0].id;
        // this is a wrapper for module. anything 'returned' becomes the exported module/function/object


         function myExportedFunction () {
             console.log("i did something here");
         }

         return myExportedFunction;
     })();})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"sample"]);

sample.min.js
---

    !function($N){$N[0][$N[1]]=($N=!!$N[0].id,function(){console.log("i did something here")})}(typeof process+typeof module+typeof require=="objectobjectfunction"?[module,"exports"]:[window,"sample"]);




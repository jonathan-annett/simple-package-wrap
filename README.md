# simple-package-wrap

- wraps javascipt modules for browser/node.js loading with minimal overhead
- creates minified versions as well as debug versions of your package
- does not support modules that `require()` other modules - this is part of a bootloader for larger a project ( see jsbldr & jsextensions repos for a way of doing that - both still under development, so use at your own risk). having said that, the buildMulti() & buildNamed() functions pretty much eliminate the need for require().

installation
===

    npm -i github:jonathan-annett/simple-package-wrap --save


when writing your modules, export a single function that "returns" the ultimate export of the deployed module
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

    $ node --require simple-package-wrap
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


**about the 2 output files**
---

both versions (x.pkg.js & x.min.js) resolve to "exploded" modules (ie the function you defined in your module.exports gets invoked as it is applied to the window/module.exports) section at runtime.

if however, you are testing your input source code in node.js you need to  `require("whatever.js")()` the file **note the additional invocation brackets.**


module combining
----

For browser deployment, you often need multiple associated modules and always want them "together".

For development reasons, it's sometimes best to keep modules as sepearate source files, but for efficiency and debugging, having them combined can be useful. (or not!)

For this reason there are 2 additional variants of the build function:

buildMulti
---

buildMulti() accepts an array of filenames (or an array of descriptors in format `{mod:"moduleName",js:"./javascript_filename.js"}` ) or an object with key value pairs in the format `{module1:"./javascript1.js",module2:"./module2.js"}`, or a combination of any of these

eg

        buildMulti([

         "./myfile1.js",

         { myRenamedModule : "./nothingLikeTheOriginalname.js" },

         {
           mod : "myModule",
           js  : "./filename.js"
         }

        ],"myoutput.js");


Where do they end up?
---
In the browser, each module ends up in `window` under it's name as a property (eg `window.myModule`) , whereas in node.js, each sub module is basically a property inside the object returned by require() - eg require("./mymod.pkg.js").myModule;


Output files
---
The individual module files are still generated when you use buildMulti, using the same naming conventions

consider the example

    buildMulti(["./somefile.js","./some-sub-module.js"],"./somefile.js")

this will NOT end up overwriting "./somefile.js" even though you have specified the samename as input and output - this is by design - all output files will end in `.pkg.js` or `min.js`, to avoid any issues along those lines.

so the above example would create:

"./somefile.pkg.js", and "./somefile.min.js"

"./some-sub-module.pkg.js" and "./some-sub-module.min.js"

It would then go ahead and replace "./somefile.pkg.js", and "./somefile.min.js" with the combined output files.

So if for some reason you wanted somefile.pkg.js without it's dependancies as a separate file, you'd be better to give the output file a different name altogether.

if the other files truely are dependancies, it might make more sense to do it as described in the example.

in any case, input source files will never be overwritten due to the naming conventions used.

buildNamed
---


buildNamed() takes exactly the same paramaters as, buildMulti, but presents the package in a slightly more human readable format.

the reason buildMulti() exists is basically to keep a similar structure to build().

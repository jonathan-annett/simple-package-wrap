 module.exports = function () {
    // this is a wrapper for module. anything 'returned' becomes the exported module/function/object


     function myExportedFunction () {
         console.log("i did something here");
     }

     return myExportedFunction;
 }


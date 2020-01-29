 module.exports = function () {
    // this is a wrapper for module. anything 'returned' becomes the exported module/function/object


     function myOtherExportedFunction () {
         console.log("i did another something here");
     }

     return myOtherExportedFunction;
 }

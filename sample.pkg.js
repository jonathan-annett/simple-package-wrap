(function($N){$N[0][$N[1]]=(function($N){
    // this is a wrapper for module. anything 'returned' becomes the exported module/function/object


     function myExportedFunction () {
         console.log("i did something here");
     }

     return myExportedFunction;
 })(!$N[0].Document);})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"mything"]);
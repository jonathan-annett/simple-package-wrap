(function($N){$N[0][$N[1]]=(function(){$N=!!$N[0].id;
function packageTemplate(){(function($N){$N[0][$N[1]]=(function acme_package(){})();})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"${acme}"]);}

    function build (filename,moduleName) {

            if (!filename) {
                if(!process.mainModule) {
                    return console.log("usage: build(filename,moduleName)");
                }
                throw new Error ("incorrect arguments passed to build");
            }



            var
            path = require("path"),
            fs =require("fs"),
            UglifyJS     = require("uglify-js"),
            babel = require("babel-core"),
            minifyJS = function minifyJS( js_src ) {
               var result1= UglifyJS.minify(js_src, {
                   parse: {},
                   compress: {},
                   mangle: false,
                   output: {
                       code: true
                   }
               });

               var result2 = babel.transform(js_src,{minified:true});


               if (!result1.code) return result2.code;

               return  (result1.code.length < result2.code.length) ? result1.code : result2.code;
            };


            moduleName = typeof moduleName==='string' ? moduleName :  path.basename(filename).split('.')[0].split('-').join('');


            var js_source;

            js_source=require(filename);
            if (typeof js_source!=='function') {
                js_source = fs.readFileSync(filename,"utf8").trim();
                js_source = js_source.substr(0,js_source.lastIndexOf('}'));
                if(!process.mainModule) {
                    console.log("loaded module as string:",js_source.length,"chars");
                }
            } else {
                if(!process.mainModule) {
                    console.log("detected exported function:",js_source.toString().length,"chars");
                }

            }

            var pkg_filename = filename.replace(/\.js$/,'.pkg.js') ;
            var min_filename = filename.replace(/\.js$/,'.min.js') ;

            js_source = makePackage(moduleName,js_source);
            fs.writeFileSync(pkg_filename ,js_source);
            if(!process.mainModule) {
                console.log("wrote:",pkg_filename);
                console.log("packaged source:",js_source.length,"chars. minifying...");
            }
            js_source = minifyJS(js_source);
            fs.writeFileSync(min_filename,js_source);
            if(!process.mainModule) {
                console.log("wrote:",min_filename);
                console.log("final minifed source:",js_source.length,"chars");
            }

            function makePackage(name,pkg_fn){

                var pkg_bare = pkg_fn.toString().trimEnd();

                var template = packageTemplate.toString().trimEnd();
                template = template.substring(template.indexOf('{')+1,template.length-1).trim().split('function acme_package(){}');
                template.push(template.pop().split('${acme}').join(name));

                return template.join(('function(){$N=!!$N[0].id;'+pkg_bare.substring(pkg_bare.indexOf('{')+1)));
            }



        }

    return {
        build : build,
        packageTemplate : packageTemplate
    }
})();})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"simplePackageWrap"]);
(function($N){$N[0][$N[1]]=(function(){$N=!!$N[0].id;
function packageTemplate(){(function($N){$N[0][$N[1]]=(function acme_package(){})();})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"${acme}"]);}

    function build (filename,moduleName) {

            var path = require("path"),
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


            var js_source;

            js_source=require(filename);
            if (typeof js_source!=='function') {
                js_source = fs.readFileSync(filename,"utf8").trim();
                js_source = js_source.substr(0,js_source.lastIndexOf('}'));
            }

            js_source = makePackage(moduleName,js_source);
            fs.writeFileSync(filename.replace(/\.js$/,'.pkg.js') ,js_source);
            js_source = minifyJS(js_source);
            fs.writeFileSync(filename.replace(/\.js$/,'.min.js'),js_source);

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
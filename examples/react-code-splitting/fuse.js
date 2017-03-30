const { Sparky, FuseBox, UglifyJSPlugin, TypeScriptHelpers, CSSPlugin, EnvPlugin } = require("fuse-box");

let producer;
let production = false;




Sparky.task("build", ["prepare"], () => {
    const fuse = FuseBox.init({
        homeDir: "src",
        output: "dist/$name.js",
        hash: production,
        cache: !production,
        plugins: [
            EnvPlugin({ NODE_ENV: production ? "production" : "development" }),
            CSSPlugin(), production && UglifyJSPlugin()
        ]
    });

    !production && fuse.dev();

    // extract dependencies automatically
    const vendor = fuse.bundle("vendor")
        .instructions(`~ **/**.{ts,tsx} +tslib`)
    if (!production) { vendor.hmr(); }

    const app = fuse.bundle("app")
        // Code splitting ****************************************************************
        .splitConfig({ browser: "bundles/", dest: "bundles/" })
        .split("routes/about/**", "about > routes/about/AboutComponent.tsx")
        .split("routes/contact/**", "contact > routes/contact/ContactComponent.tsx")
        .split("routes/home/**", "home > routes/home/HomeComponent.tsx")
        // bundle the entry point without deps
        // bundle routes for lazy loading as there is not require statement in or entry point
        .instructions(`> [app.tsx] + [routes/**/**.{ts, tsx}]`)

    if (!production) { app.hmr().watch() }

    return fuse.run().then((fuseProducer) => {
        producer = fuseProducer;
    });
});

// main task
Sparky.task("default", ["clean", "build", "make-html"], () => {});

// wipe it all
Sparky.task("clean", () => Sparky.src("dist/*").clean("dist/"));

// copy and replace HTML
Sparky.task("make-html", () => {
    return Sparky.src("src/index.html")
        .file("*", file => {
            let fname;
            const vendor = producer.bundles.get("vendor");
            const app = producer.bundles.get("app");
            // get generated bundle names
            file.template({
                vendor: vendor.context.output.lastGeneratedFileName,
                app: app.context.output.lastGeneratedFileName,
            });
        })
        .dest("dist/$name")
});

Sparky.task("set-production-env", () => production = true);
Sparky.task("dist", ["clean", "set-production-env", "build", "make-html"], () => {})
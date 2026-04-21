import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";

export default defineConfig({
    plugins: [
        devServer({
            entry: "src/index.ts", // The file path of your application.
        }),
    ],
    server: {
        cors: {
            origin: "http://localhost:3000",
            credentials: true,
        },
        port: 3001,
    },
    build: {
        rollupOptions: {
            input: "src/index.ts", // This tells Vite: "This is the file I want you to bundle!"
            output: {
                dir: "dist", // This tells Vite: "Put the bundled file in the 'dist' folder!"
                format: "esm", // This tells Vite: "Use ES Modules format for the bundled file!"
                entryFileNames: "index.js", // This tells Vite: "Name the bundled file 'index.js'!"
                codeSplitting: true, // This tells Vite: "If there are multiple entry points, split the code into separate files!"
                // minify: true, // This tells Vite: "Minify the bundled code to reduce file size!"
            },
        },
        target: "node22", // This tells Vite: "The bundled code should be compatible with Node.js version 22!"
        ssr: true, // This tells Vite: "This is a server-side application, so bundle it for SSR (Server-Side Rendering)!"
    },
});

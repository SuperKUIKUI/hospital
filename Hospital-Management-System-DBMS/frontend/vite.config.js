import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
    },
    build: {
        outDir: "dist",
        rolldownOptions: {
            output: {
                minify: true,
                codeSplitting: {
                    groups: [
                        {
                            name: "react-vendor",
                            test: /node_modules[\\/]react/,
                            priority: 20,
                        },
                        { name: "api", test: /src[\\/]api/, priority: 15 },
                        { name: "vendor", test: /node_modules/, priority: 10 },
                        { name: "common", test: /src/, priority: 5 },
                    ],
                },
                format: "es",
                hashCharacters: "hex",
            },
        },
    },
});

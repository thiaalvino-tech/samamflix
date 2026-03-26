import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  publicDir: "public",
  server: {
    host: true,
    port: 3000
  },
  build: {
    target: "esnext",
    minify: "terser",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "login.html"),
        perfil: resolve(__dirname, "perfil.html"),
        users: resolve(__dirname, "usuarios.html"),
        analytics: resolve(__dirname, "analytics.html"),
        face: resolve(__dirname, "face.html"),
        video: resolve(__dirname, "video.html"),
        adminDashboard: resolve(__dirname, "admin/dashboard.html"),
        adminVideos: resolve(__dirname, "admin/videos.html"),
        adminCategorias: resolve(__dirname, "admin/categorias.html"),
        adminComentarios: resolve(__dirname, "admin/comentarios.html"),
        adminAnalytics: resolve(__dirname, "admin/analytics.html"),
        adminSetter: resolve(__dirname, "admin-setter.html"),
        setupAdmin: resolve(__dirname, "setup-admin.html")
      }
    }
  }
});

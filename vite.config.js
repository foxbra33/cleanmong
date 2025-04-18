import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    {
      name: 'hitbox-config-server',
      configureServer(server) {
        server.middlewares.use('/api/save-hitbox-config', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }
          
          try {
            // Parse multipart form data
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            
            // Extract file content and path details from buffer
            const contentString = buffer.toString();
            
            // Find the file data in the multipart form
            const fileMatch = contentString.match(/Content-Disposition: form-data; name="file"; filename="(.+?)"\r\n.+?\r\n\r\n([\s\S]+?)(?:-{6}|$)/);
            const pathMatch = contentString.match(/Content-Disposition: form-data; name="path"\r\n\r\n(.+?)\r\n/);
            
            if (fileMatch && pathMatch) {
              const fileName = fileMatch[1];
              const fileContent = fileMatch[2];
              const filePath = pathMatch[1];
              
              // Ensure directory exists
              const fullPath = path.join(process.cwd(), filePath);
              
              if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
              }
              
              // Write file
              const fullFilePath = path.join(fullPath, fileName);
              fs.writeFileSync(fullFilePath, fileContent);
              
              res.statusCode = 200;
              res.end(JSON.stringify({ 
                success: true, 
                message: `File ${fileName} saved successfully to ${filePath}`,
                path: fullFilePath
              }));
            } else {
              throw new Error('Invalid form data');
            }
          } catch (error) {
            console.error('Error saving file:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ 
              error: 'Server error', 
              message: error.message 
            }));
          }
        });
      }
    }
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Content-Security-Policy': "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'; object-src 'none';"
    },
  },
}); 
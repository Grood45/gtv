# AWS Deployment Guide - Full Project

Complete step-by-step guide to deploy this project on an AWS EC2 instance (Ubuntu).

## 1. Server Setup (Ubuntu 22.04 LTS)

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js (v20)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Install Global Tools (PM2)
```bash
sudo npm install -g pm2
```

### Install Global Tools (PM2)
```bash
sudo npm install -g pm2
```

## 2. Project Setup

### Clone Repository
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd fullgivecan
```

### Install Dependencies
```bash
npm install
```

## 3. Environment Variables (.env)
Create the `.env` file in the project root:
```bash
nano .env
```
Paste this content (replace values with your actual credentials):

```env
# Server Port
PORT=4000

# MongoDB Connection String (Atlas/Local)
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/fullgivecan

# Admin Credentials (If used)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secretpassword
GEMINI_API_KEY=your_gemini_key

# Node Environment (Important for PM2)
NODE_ENV=production
```
Press `Ctrl+X`, then `Y`, then `Enter` to save.

## 4. Run with PM2 (Process Manager)
We have already configured `ecosystem.config.js`. Just run:

```bash
# Start the app in Cluster Mode (Uses all CPU cores)
pm2 start ecosystem.config.js

# Save configuration to auto-start on reboot
pm2 save
pm2 startup
```
(Copy and run the command that `pm2 startup` outputs)

## 5. Nginx Setup (Reverse Proxy)
Install Nginx to handle public traffic and point it to your PM2 app (Port 4000).

```bash
sudo apt install nginx -y
```

Create a new config file:
```bash
sudo nano /etc/nginx/sites-available/fullgivecan
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com; # Replace with your domain or IP

    location / {
        proxy_pass http://localhost:4000; # Point to Node.js app
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/fullgivecan /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Alternative: Sub-path Configuration (e.g., /live/)
If you want to host the project under a sub-path like `domain.com/live/`, use this in your Nginx config:

```nginx
location /live/ {
    proxy_pass http://127.0.0.1:4000/; # Note the trailing slash!
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```
**Note:** The trailing slash in `proxy_pass http://127.0.0.1:4000/;` tells Nginx to strip `/live/` before sending the request to Node.js. This means your **API routes in the code will not change**.


## 6. SSL Certificate (HTTPS) - Optional but Recommended
Use Certbot to get a free SSL certificate.

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 🚀 Optimization Logic (Explained)
Your project is now using:
- **PM2**: Handles crashes and restarts automatically.
- **Rate Limit**: Blocks spammers (Max 300 requests/15 mins per IP).
- **Compression**: Speeds up API responses.
- **Helmet**: Secures HTTP headers.
- **On-Demand Fetching**: Saves server resources by only fetching streams when requested.

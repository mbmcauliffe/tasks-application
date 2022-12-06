echo "Ensure the .env file has been populated before continuing."
read noUse

sudo apt update
sudo apt upgrade -y
sudo apt install -y git nodejs npm gnupg psmisc certbot
timedatectl set-timezone America/Chicago

# Add MongoDB to APT Repository List
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/mongodb-keyring.gpg] http://repo.mongodb.org/apt/debian buster/mongodb-org/4.4 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list

sudo apt update
sudo apt upgrade -y
sudo apt install -y mongodb-org
sudo apt autoremove -y

npm install -g n
n lts
hash -r
npm install -g npm@latest
npm install
npx greenlock add --subject $domain --altnames $domain

# Initialize Crontab
sudo crontab -l > cronLines

# Write to Crontab
sudo echo "@reboot apt update && apt upgrade -y && apt autoremove -y"
sudo echo "@reboot systemctl start mongod"
sudo echo "@reboot nodejs /root/tasks-application/index.js" >> cronLines

# Save Crontab
sudo crontab cronLines
sudo rm -f cronLines

sudo certbot certonly --standalone
certbot renew --dry-run

sudo systemctl start mongod
npm run main
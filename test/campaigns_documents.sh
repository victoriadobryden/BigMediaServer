curl -c /tmp/cookies.txt -s --data 'username=ntk&password=eDuhsrF8&rememberme=1' http://localhost:3000/auth/local/login
curl -b /tmp/cookies.txt -s http://localhost:3000/campaigns/66980/documents | json_reformat | head -n 30

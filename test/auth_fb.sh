APP_ID=1308134669200550
TEST_USER_ID=117323858753290 
access_token=$(curl -s -X GET   "https://graph.facebook.com/v2.8/${APP_ID}/accounts/test-users?access_token=${APP_ID}%7Caa06639f6d0d9edec7172d5e8ea80c1b&fields=access_token" | json_pp | grep -B 1 -A 1  $TEST_USER_ID  | grep access_token | grep -o '"[^"]\+"' | tail -n 1)
TOKEN=${access_token:1: -1}
curl -s 'http://localhost:3000/auth/facebook-token' --data "access_token=$TOKEN" | json_reformat

USERNAME=test$RANDOM$RANDOM
curl -v --data "username=$USERNAME&password=11111&orgname=org_$USERNAME&email=${USERNAME}@some.test" http://localhost:3000/auth/local/signup

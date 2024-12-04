curl -s http://localhost:3000/subjects/135654
echo
curl -s http://localhost:3000/subjects//image.jpeg
echo
curl -s http://localhost:3000/subjects/135654/image.jpeg | xxd | head -n 5



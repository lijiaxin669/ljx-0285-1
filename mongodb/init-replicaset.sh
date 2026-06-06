#!/bin/bash

echo "Waiting for MongoDB to start..."
sleep 10

echo "Initializing replica set..."

mongosh --host mongodb:27017 -u admin -p password123 --authenticationDatabase admin <<EOF
try {
  const status = rs.status();
  print('Replica set already initialized');
} catch (e) {
  print('Initializing replica set...');
  rs.initiate({
    _id: 'rs0',
    members: [
      { _id: 0, host: 'mongodb:27017' }
    ]
  });
  print('Replica set initialized');
}
EOF

echo "Replica setup complete"

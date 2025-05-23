# Sui Bridge Analytics

## Overview

The **Sui Bridge Analytics Dashboard** is a web application designed to provide comprehensive analytics on the Sui Bridge ecosystem. It visualizes data related to inflows, outflows, volume, and stocks of bridged assets. The dashboard leverages the open-source Sui Bridge indexer to gather and display data in an intuitive and user-friendly way.

### Project URL

[Preview Dashboard Analytics](https://suianalytics.io)

## Screenshots

<img width="1512" alt="image" src="https://github.com/user-attachments/assets/7ae043a3-9424-4b45-bd80-d71f6296bf26" />

<img width="1512" alt="image" src="https://github.com/user-attachments/assets/7b71bc75-35bc-432d-af5b-1fe6660c9126" />

<img width="1512" alt="image" src="https://github.com/user-attachments/assets/519a5daa-618b-415b-8db8-cb739895a7d4" />

## Contributing

We welcome contributions! Please feel free to submit issues or pull requests.

## Fees API

Daily gas usage statistics can be retrieved via:

```bash
GET /api/fees?network=mainnet
```

Example response:

```json
[
  {
    "transfer_date": "2024-05-01",
    "eth_gas_usage": "123456",
    "sui_gas_usage": "78910"
  }
]
```

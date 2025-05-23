# Sui Bridge Analytics

## Overview

The **Sui Bridge Analytics Dashboard** is a web application designed to provide comprehensive analytics on the Sui Bridge ecosystem. It visualizes data related to inflows, outflows, volume, and stocks of bridged assets. The dashboard leverages the open-source Sui Bridge indexer to gather and display data in an intuitive and user-friendly way.

### Project URL

[Preview Dashboard Analytics](https://suianalytics.io)

## Screenshots

<img width="1512" alt="image" src="https://github.com/user-attachments/assets/7ae043a3-9424-4b45-bd80-d71f6296bf26" />

<img width="1512" alt="image" src="https://github.com/user-attachments/assets/7b71bc75-35bc-432d-af5b-1fe6660c9126" />

<img width="1512" alt="image" src="https://github.com/user-attachments/assets/519a5daa-618b-415b-8db8-cb739895a7d4" />

## Getting Started

### Prerequisites

- **Node.js 20.x**
- **Yarn** (v1.22 or later)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-org/sui-bridge.git
   cd sui-bridge
   ```
2. Install dependencies
   ```bash
   yarn install
   ```

### Running the Development Server

Start a local development server on <http://localhost:8083>:

```bash
yarn dev
```

### Building for Production

Create an optimized production build:

```bash
yarn build
```

Run the built app locally:

```bash
yarn start
```

### Environment Variables

The API routes require access to a PostgreSQL database. Create a `.env` file or export the following variables in your shell before running the server:

```bash
SUI_BRIDGE_POSTGRES_URL=<database connection string>
SUI_BRIDGE_TESTNET_POSTGRES_URL=<testnet connection string>
```

These values are read in `src/pages/api/secrets.ts`.

## Contributing

We welcome contributions! Please feel free to submit issues or pull requests.


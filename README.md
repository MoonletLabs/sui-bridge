# Sui Bridge Analytics

## Overview

The **Sui Bridge Analytics Dashboard** is a web application designed to provide comprehensive analytics on the Sui Bridge ecosystem. It visualizes data related to inflows, outflows, volume, and stocks of bridged assets. The dashboard leverages the open-source Sui Bridge indexer to gather and display data in an intuitive and user-friendly way.

### Project URL

[Preview Dashboard Analytics](https://suianalytics.io)

## Screenshots

![image](https://github.com/user-attachments/assets/d50edaa2-247d-49ce-9df3-0ef2ad8daf94)

![image](https://github.com/user-attachments/assets/c6df9aad-2b86-451d-a225-1b9505189837)

![image](https://github.com/user-attachments/assets/afdd7c47-eaeb-44b1-956d-3f901a360225)

![image](https://github.com/user-attachments/assets/ef382160-140b-4488-871a-e5f83cbece81)

![image](https://github.com/user-attachments/assets/d17bac49-da89-4a36-929c-b0edf401e005)




## Getting Started

### Prerequisites

- **Node.js 20.x**
- **Yarn** (v1.22 or later)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/MoonletLabs/sui-bridge.git
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


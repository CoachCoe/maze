/**
 * Address Utilities for Substrate <-> EVM conversion
 * Handles conversion between Ethereum H160 addresses and Substrate SS58 addresses
 */

class AddressUtils {
  // Paseo Asset Hub SS58 prefix (same as Polkadot)
  static SS58_PREFIX = 0;

  /**
   * Convert Ethereum H160 address to Substrate SS58 address
   * @param {string} h160Address - Ethereum address (0x...)
   * @returns {string} SS58 encoded address
   */
  static h160ToSS58(h160Address) {
    try {
      // Remove 0x prefix and convert to lowercase
      const cleanAddress = h160Address.toLowerCase().replace('0x', '');

      // Convert hex string to Uint8Array
      const addressBytes = new Uint8Array(
        cleanAddress.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
      );

      // Pad to 32 bytes for Substrate address (H160 is 20 bytes)
      // We use the ethereum-compatible account scheme: 0x + 20 bytes + 0-padding
      const paddedBytes = new Uint8Array(32);
      paddedBytes.set(addressBytes, 0);

      // Encode to SS58 format using Polkadot utilities
      const ss58Address = polkadotUtilCrypto.encodeAddress(paddedBytes, this.SS58_PREFIX);

      return ss58Address;
    } catch (error) {
      console.error('Error converting H160 to SS58:', error);
      return h160Address; // Fallback to original
    }
  }

  /**
   * Convert Substrate SS58 address to Ethereum H160 address
   * @param {string} ss58Address - SS58 encoded address
   * @returns {string} Ethereum address (0x...)
   */
  static ss58ToH160(ss58Address) {
    try {
      // Decode SS58 address to bytes
      const decoded = polkadotUtilCrypto.decodeAddress(ss58Address);

      // Take first 20 bytes (H160)
      const h160Bytes = decoded.slice(0, 20);

      // Convert to hex string
      const h160Address = '0x' + Array.from(h160Bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return h160Address;
    } catch (error) {
      console.error('Error converting SS58 to H160:', error);
      return ss58Address; // Fallback to original
    }
  }

  /**
   * Format address for display (shortened)
   * @param {string} address - Full address
   * @param {number} startChars - Characters to show at start
   * @param {number} endChars - Characters to show at end
   * @returns {string} Formatted address
   */
  static formatAddress(address, startChars = 6, endChars = 4) {
    if (address.length <= startChars + endChars) {
      return address;
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }

  /**
   * Check if address is valid Ethereum H160 format
   * @param {string} address - Address to check
   * @returns {boolean} True if valid H160
   */
  static isValidH160(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Check if address is valid SS58 format
   * @param {string} address - Address to check
   * @returns {boolean} True if valid SS58
   */
  static isValidSS58(address) {
    try {
      polkadotUtilCrypto.decodeAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get address type
   * @param {string} address - Address to check
   * @returns {string} 'h160', 'ss58', or 'unknown'
   */
  static getAddressType(address) {
    if (this.isValidH160(address)) return 'h160';
    if (this.isValidSS58(address)) return 'ss58';
    return 'unknown';
  }

  /**
   * Ensure address is in H160 format (for contract calls)
   * @param {string} address - Address in any format
   * @returns {string} H160 address
   */
  static toH160(address) {
    const type = this.getAddressType(address);
    if (type === 'h160') return address;
    if (type === 'ss58') return this.ss58ToH160(address);
    throw new Error('Invalid address format');
  }

  /**
   * Ensure address is in SS58 format (for display)
   * @param {string} address - Address in any format
   * @returns {string} SS58 address
   */
  static toSS58(address) {
    const type = this.getAddressType(address);
    if (type === 'ss58') return address;
    if (type === 'h160') return this.h160ToSS58(address);
    throw new Error('Invalid address format');
  }
}

// Wait for Polkadot utilities to be ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', async () => {
    // Initialize crypto utilities
    await polkadotUtilCrypto.cryptoWaitReady();
    console.log('Polkadot address utilities ready');
  });
}

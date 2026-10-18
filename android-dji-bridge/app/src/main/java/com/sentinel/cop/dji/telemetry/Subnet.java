package com.sentinel.cop.dji.telemetry;

/** IPv4 prefix arithmetic, kept free of Android types so the routing decision runs on a JVM. */
public final class Subnet {
    private Subnet() { }

    public static boolean contains(byte[] network, int prefixLength, byte[] address) {
        if (network == null || address == null || network.length != 4 || address.length != 4) return false;
        if (prefixLength < 0 || prefixLength > 32) return false;
        int mask = prefixLength == 0 ? 0 : -1 << (32 - prefixLength);
        return (toInt(network) & mask) == (toInt(address) & mask);
    }

    private static int toInt(byte[] value) {
        return (value[0] & 0xff) << 24 | (value[1] & 0xff) << 16 | (value[2] & 0xff) << 8 | (value[3] & 0xff);
    }
}

package com.sentinel.cop.dji.telemetry;

/** Numeric IPv4 only: avoid DNS delays and ambiguous interface selection during setup. */
public final class Destination {
    public final String host;
    public final int port;
    private Destination(String host, int port) { this.host = host; this.port = port; }

    public static Destination parse(String hostInput, String portInput) {
        String host = hostInput.trim();
        String[] parts = host.split("\\.", -1);
        if (parts.length != 4) throw new IllegalArgumentException("Enter the laptop's numeric Wi-Fi IPv4 address.");
        for (String part : parts) {
            if (!part.matches("[0-9]{1,3}") || Integer.parseInt(part) > 255)
                throw new IllegalArgumentException("Invalid IPv4 address.");
        }
        int first = Integer.parseInt(parts[0]);
        if (first == 0 || first >= 224 || host.equals("255.255.255.255"))
            throw new IllegalArgumentException("Use a unicast laptop address, not a wildcard or broadcast address.");
        int port;
        try { port = Integer.parseInt(portInput.trim()); }
        catch (NumberFormatException e) { throw new IllegalArgumentException("Port must be a number from 1 to 65535."); }
        if (port < 1 || port > 65535) throw new IllegalArgumentException("Port must be from 1 to 65535.");
        return new Destination(host, port);
    }
}

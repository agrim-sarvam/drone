package com.sentinel.cop.dji;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import com.sentinel.cop.dji.telemetry.Subnet;
import com.sentinel.cop.dji.telemetry.TelemetryUdpExporter;
import java.io.IOException;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;

/**
 * Pins telemetry to the non-cellular network that contains the laptop's address.
 *
 * Android sends unbound sockets over the default network. When the field Wi-Fi (or a laptop hotspot)
 * has no Internet, Android keeps mobile data as the default network and LAN packets leave over
 * cellular, so the laptop never sees them. A phone hotspot is not a Network here; unbound sockets
 * already reach tethered clients, so that case is left on the system default.
 */
final class LocalNetworkRoute implements TelemetryUdpExporter.Route {
    private final ConnectivityManager connectivity;

    LocalNetworkRoute(Context context) {
        connectivity = (ConnectivityManager) context.getApplicationContext().getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    @Override public String bind(DatagramSocket socket, InetAddress destination) throws IOException {
        if (connectivity == null || !(destination instanceof Inet4Address)) return "system default";
        for (Network network : connectivity.getAllNetworks()) {
            NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(network);
            LinkProperties link = connectivity.getLinkProperties(network);
            if (capabilities == null || link == null) continue;
            if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
                    || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue;
            for (LinkAddress address : link.getLinkAddresses()) {
                if (!(address.getAddress() instanceof Inet4Address)) continue;
                if (Subnet.contains(address.getAddress().getAddress(), address.getPrefixLength(), destination.getAddress())) {
                    network.bindSocket(socket);
                    String kind = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ? "Wi-Fi" : "local network";
                    return kind + " " + link.getInterfaceName();
                }
            }
        }
        return "system default (laptop not on a joined Wi-Fi subnet; expected on phone hotspot)";
    }
}

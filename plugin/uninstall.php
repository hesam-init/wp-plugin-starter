<?php
/**
 * Runs when the plugin is deleted from the Plugins screen.
 *
 * Data is only removed if the "Delete data on uninstall" setting is enabled,
 * so users don't lose content by accident.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Remove plugin data for the current site.
 */
function wp_plugin_starter_uninstall_site(): void {
	global $wpdb;

	$settings = get_option( 'wp_plugin_starter_settings', array() );
	if ( ! is_array( $settings ) || empty( $settings['deleteDataOnUninstall'] ) ) {
		return;
	}

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
	$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $wpdb->prefix . 'wp_plugin_starter_items' ) );

	delete_option( 'wp_plugin_starter_settings' );
	delete_option( 'wp_plugin_starter_db_version' );
	wp_cache_flush_group( 'wp_plugin_starter_items' );
}

if ( is_multisite() ) {
	foreach ( get_sites( array( 'fields' => 'ids' ) ) as $wp_plugin_starter_site_id ) {
		switch_to_blog( (int) $wp_plugin_starter_site_id );
		wp_plugin_starter_uninstall_site();
		restore_current_blog();
	}
} else {
	wp_plugin_starter_uninstall_site();
}

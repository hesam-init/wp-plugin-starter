<?php
/**
 * Database schema + versioned migrations.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Database;

defined( 'ABSPATH' ) || exit;

/**
 * Creates/updates custom tables with dbDelta. Bump DB_VERSION whenever the
 * schema changes; maybe_upgrade() then re-runs install() on the next request.
 */
final class Installer {

	public const DB_VERSION = '1.0.0';
	public const OPTION     = 'wp_plugin_starter_db_version';

	/**
	 * Fully-qualified items table name.
	 */
	public static function items_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'wp_plugin_starter_items';
	}

	/**
	 * Run migrations when the stored schema version is outdated.
	 */
	public function maybe_upgrade(): void {
		if ( get_option( self::OPTION ) !== self::DB_VERSION ) {
			$this->install();
		}
	}

	/**
	 * Create or update tables. dbDelta is idempotent.
	 */
	public function install(): void {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table           = self::items_table();
		$charset_collate = $wpdb->get_charset_collate();

		// dbDelta is picky: two spaces after PRIMARY KEY, one field per line.
		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			title varchar(191) NOT NULL,
			content longtext NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'draft',
			author_id bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY status (status),
			KEY created_at (created_at)
		) {$charset_collate};";

		dbDelta( $sql );

		update_option( self::OPTION, self::DB_VERSION, false );
	}
}

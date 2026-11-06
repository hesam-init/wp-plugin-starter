<?php
/**
 * Data access for items stored in a custom table.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Items;

use WP_Error;
use WpPluginStarter\Database\Installer;

defined( 'ABSPATH' ) || exit;

// Direct queries are the point of a repository over a custom table; results are object-cached below.
// phpcs:disable WordPress.DB.DirectDatabaseQuery

/**
 * Repository: the only class that talks SQL. Controllers never touch $wpdb.
 *
 * @phpstan-type ItemRow array{id:int, title:string, content:string, status:string, author_id:int, created_at:string, updated_at:string}
 */
final class ItemRepository {

	public const STATUSES     = array( 'draft', 'published' );
	public const ORDERABLE    = array( 'id', 'title', 'status', 'created_at', 'updated_at' );
	private const CACHE_GROUP = 'wp_plugin_starter_items';

	/**
	 * Find a single item.
	 *
	 * @param int $id Item ID.
	 * @return ItemRow|null
	 *
	 * @phpstan-impure Reads the database/cache, so repeated calls may differ (e.g. after update()).
	 */
	public function find( int $id ): ?array {
		global $wpdb;

		$cached = wp_cache_get( $id, self::CACHE_GROUP );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$row = $wpdb->get_row(
			$wpdb->prepare( 'SELECT * FROM %i WHERE id = %d', Installer::items_table(), $id ),
			ARRAY_A
		);

		if ( ! is_array( $row ) ) {
			return null;
		}

		$item = $this->hydrate( $row );
		wp_cache_set( $id, $item, self::CACHE_GROUP );

		return $item;
	}

	/**
	 * Paginated, filterable list.
	 *
	 * @param array{page?:int, per_page?:int, search?:string, status?:string, orderby?:string, order?:string} $args Query args.
	 * @return array{items: list<ItemRow>, total: int}
	 */
	public function paginate( array $args ): array {
		global $wpdb;

		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$per_page = min( 100, max( 1, (int) ( $args['per_page'] ?? 10 ) ) );
		$orderby  = in_array( $args['orderby'] ?? '', self::ORDERABLE, true ) ? $args['orderby'] : 'created_at';
		$order    = 'ASC' === strtoupper( $args['order'] ?? '' ) ? 'ASC' : 'DESC';

		$where  = array( '1=1' );
		$params = array();

		if ( ! empty( $args['status'] ) && in_array( $args['status'], self::STATUSES, true ) ) {
			$where[]  = 'status = %s';
			$params[] = $args['status'];
		}
		if ( ! empty( $args['search'] ) ) {
			$where[]  = '(title LIKE %s OR content LIKE %s)';
			$like     = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$params[] = $like;
			$params[] = $like;
		}

		$table     = Installer::items_table();
		$where_sql = implode( ' AND ', $where );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- $where_sql only holds placeholders, filled by the spread $params; $order is whitelisted.
		$total = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM %i WHERE {$where_sql}", $table, ...$params )
		);

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM %i WHERE {$where_sql} ORDER BY %i {$order}, id {$order} LIMIT %d OFFSET %d",
				$table,
				...array_merge( $params, array( $orderby, $per_page, ( $page - 1 ) * $per_page ) )
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber

		return array(
			'items' => array_map( array( $this, 'hydrate' ), is_array( $rows ) ? $rows : array() ),
			'total' => $total,
		);
	}

	/**
	 * Insert an item.
	 *
	 * @param array{title:string, content?:string, status?:string} $data Item fields.
	 * @return int|WP_Error New item ID.
	 */
	public function create( array $data ) {
		global $wpdb;

		$now = current_time( 'mysql', true );
		$ok  = $wpdb->insert(
			Installer::items_table(),
			array(
				'title'      => $data['title'],
				'content'    => $data['content'] ?? '',
				'status'     => $data['status'] ?? 'draft',
				'author_id'  => get_current_user_id(),
				'created_at' => $now,
				'updated_at' => $now,
			),
			array( '%s', '%s', '%s', '%d', '%s', '%s' )
		);

		if ( false === $ok ) {
			return new WP_Error( 'wp_plugin_starter_db_error', __( 'Could not create item.', 'wp-plugin-starter' ), array( 'status' => 500 ) );
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Update an item (partial).
	 *
	 * @param int                                                   $id   Item ID.
	 * @param array{title?:string, content?:string, status?:string} $data Fields to change.
	 * @return true|WP_Error
	 */
	public function update( int $id, array $data ) {
		global $wpdb;

		$fields = array_intersect_key( $data, array_flip( array( 'title', 'content', 'status' ) ) );
		if ( array() === $fields ) {
			return true;
		}
		$fields['updated_at'] = current_time( 'mysql', true );

		$ok = $wpdb->update( Installer::items_table(), $fields, array( 'id' => $id ), null, array( '%d' ) );
		wp_cache_delete( $id, self::CACHE_GROUP );

		if ( false === $ok ) {
			return new WP_Error( 'wp_plugin_starter_db_error', __( 'Could not update item.', 'wp-plugin-starter' ), array( 'status' => 500 ) );
		}

		return true;
	}

	/**
	 * Delete an item.
	 *
	 * @param int $id Item ID.
	 */
	public function delete( int $id ): bool {
		global $wpdb;

		$deleted = $wpdb->delete( Installer::items_table(), array( 'id' => $id ), array( '%d' ) );
		wp_cache_delete( $id, self::CACHE_GROUP );

		return (bool) $deleted;
	}

	/**
	 * Whether the items table exists (used by the status report).
	 */
	public function table_exists(): bool {
		global $wpdb;

		$table = Installer::items_table();

		return $table === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) );
	}

	/**
	 * Total number of items, regardless of status.
	 */
	public function count(): int {
		global $wpdb;

		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM %i', Installer::items_table() ) );
	}

	/**
	 * Cast a DB row to typed values.
	 *
	 * @param array<string, mixed> $row Raw row.
	 * @return ItemRow
	 */
	private function hydrate( array $row ): array {
		return array(
			'id'         => (int) $row['id'],
			'title'      => (string) $row['title'],
			'content'    => (string) $row['content'],
			'status'     => (string) $row['status'],
			'author_id'  => (int) $row['author_id'],
			'created_at' => (string) $row['created_at'],
			'updated_at' => (string) $row['updated_at'],
		);
	}
}

<?php
/**
 * Plugin settings stored in a single option, described by a JSON schema.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Settings;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * The schema here is the single source of truth: the REST controller uses it
 * for validation/sanitization, and the React app mirrors it with zod.
 */
final class Settings {

	public const OPTION = 'wp_plugin_starter_settings';

	/**
	 * JSON schema (draft-04 subset supported by WordPress) for each setting.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function schema(): array {
		return array(
			'welcomeMessage'        => array(
				'description' => __( 'Message shown at the top of the plugin page.', 'wp-plugin-starter' ),
				'type'        => 'string',
				'maxLength'   => 200,
				'default'     => __( 'Welcome! Manage your items below.', 'wp-plugin-starter' ),
				'arg_options' => array( 'sanitize_callback' => 'sanitize_text_field' ),
			),
			'itemsPerPage'          => array(
				'description' => __( 'Number of items per page in the admin list.', 'wp-plugin-starter' ),
				'type'        => 'integer',
				'minimum'     => 1,
				'maximum'     => 100,
				'default'     => 10,
			),
			'mode'                  => array(
				'description' => __( 'Operating mode.', 'wp-plugin-starter' ),
				'type'        => 'string',
				'enum'        => array( 'simple', 'advanced' ),
				'default'     => 'simple',
			),
			'deleteDataOnUninstall' => array(
				'description' => __( 'Remove all plugin data when the plugin is deleted.', 'wp-plugin-starter' ),
				'type'        => 'boolean',
				'default'     => false,
			),
		);
	}

	/**
	 * Default values derived from the schema.
	 *
	 * @return array<string, mixed>
	 */
	public static function defaults(): array {
		return array_map( static fn( array $prop ) => $prop['default'], self::schema() );
	}

	/**
	 * Current settings merged over defaults, coerced to schema types.
	 *
	 * @return array<string, mixed>
	 */
	public function all(): array {
		$stored = get_option( self::OPTION, array() );
		$stored = is_array( $stored ) ? $stored : array();
		$values = array();

		foreach ( self::schema() as $key => $prop ) {
			$value          = array_key_exists( $key, $stored ) ? $stored[ $key ] : $prop['default'];
			$valid          = rest_validate_value_from_schema( $value, $prop, $key );
			$values[ $key ] = is_wp_error( $valid ) ? $prop['default'] : rest_sanitize_value_from_schema( $value, $prop, $key );
		}

		return $values;
	}

	/**
	 * Get one setting.
	 *
	 * @param string $key Setting key.
	 * @return mixed
	 */
	public function get( string $key ) {
		return $this->all()[ $key ] ?? null;
	}

	/**
	 * Partially update settings. Unknown keys are ignored.
	 *
	 * @param array<string, mixed> $changes Key/value pairs to update.
	 * @return array<string, mixed>|WP_Error The full, updated settings.
	 */
	public function update( array $changes ) {
		$schema = self::schema();
		$values = $this->all();

		foreach ( $changes as $key => $value ) {
			if ( ! isset( $schema[ $key ] ) ) {
				continue;
			}
			$valid = rest_validate_value_from_schema( $value, $schema[ $key ], $key );
			if ( is_wp_error( $valid ) ) {
				return $valid;
			}
			$values[ $key ] = rest_sanitize_value_from_schema( $value, $schema[ $key ], $key );
		}

		update_option( self::OPTION, $values );

		return $values;
	}
}

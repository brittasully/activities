<?php
/**
 * Plugin Name: Digital Coloring Pages
 * Description: Generate simplified coloring pages from media images and embed an interactive digital coloring experience with a shortcode.
 * Version: 1.0.0
 * Author: Codex
 * Text Domain: digital-coloring-pages
 */

if (! defined('ABSPATH')) {
    exit;
}

final class Digital_Coloring_Pages_Plugin
{
    private const NONCE_ACTION_ADMIN = 'dcp_admin_nonce_action';
    private const NONCE_ACTION_FRONT = 'dcp_front_nonce_action';
    private const CPT = 'dcp_coloring_page';
    private const META_ORIGINAL_ATTACHMENT = '_dcp_original_attachment_id';
    private const META_OUTLINE_ATTACHMENT = '_dcp_outline_attachment_id';

    public function __construct()
    {
        add_action('init', [$this, 'register_post_type']);
        add_action('add_meta_boxes', [$this, 'register_meta_boxes']);
        add_action('admin_menu', [$this, 'register_admin_page']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_front_assets']);
        add_action('wp_ajax_dcp_create_coloring_page', [$this, 'ajax_create_coloring_page']);
        add_action('wp_ajax_dcp_get_coloring_page', [$this, 'ajax_get_coloring_page']);
        add_shortcode('digital_coloring_page', [$this, 'render_shortcode']);
    }

    public function register_post_type(): void
    {
        register_post_type(
            self::CPT,
            [
                'labels' => [
                    'name' => esc_html__('Coloring Pages', 'digital-coloring-pages'),
                    'singular_name' => esc_html__('Coloring Page', 'digital-coloring-pages'),
                ],
                'public' => true,
                'show_in_menu' => true,
                'show_in_rest' => true,
                'supports' => ['title'],
                'menu_icon' => 'dashicons-art',
            ]
        );
    }

    public function register_meta_boxes(): void
    {
        add_meta_box(
            'dcp_page_details',
            esc_html__('Coloring Page Assets', 'digital-coloring-pages'),
            [$this, 'render_meta_box'],
            self::CPT,
            'normal',
            'default'
        );
    }

    public function render_meta_box(\WP_Post $post): void
    {
        $original_id = absint(get_post_meta($post->ID, self::META_ORIGINAL_ATTACHMENT, true));
        $outline_id = absint(get_post_meta($post->ID, self::META_OUTLINE_ATTACHMENT, true));
        $original_url = $original_id ? wp_get_attachment_image_url($original_id, 'medium') : '';
        $outline_url = $outline_id ? wp_get_attachment_image_url($outline_id, 'medium') : '';
        ?>
        <p>
            <strong><?php echo esc_html__('Original image ID:', 'digital-coloring-pages'); ?></strong>
            <?php echo esc_html($original_id ? (string) $original_id : '—'); ?>
        </p>
        <p>
            <strong><?php echo esc_html__('Outline image ID:', 'digital-coloring-pages'); ?></strong>
            <?php echo esc_html($outline_id ? (string) $outline_id : '—'); ?>
        </p>
        <?php if ($original_url) : ?>
            <p><img src="<?php echo esc_url($original_url); ?>" alt="" style="max-width: 280px; height: auto;"></p>
        <?php endif; ?>
        <?php if ($outline_url) : ?>
            <p><img src="<?php echo esc_url($outline_url); ?>" alt="" style="max-width: 280px; height: auto;"></p>
        <?php endif; ?>
        <p>
            <?php echo esc_html__('Shortcode:', 'digital-coloring-pages'); ?>
            <code>[digital_coloring_page id="<?php echo esc_attr((string) $post->ID); ?>"]</code>
        </p>
        <?php
    }

    public function register_admin_page(): void
    {
        add_submenu_page(
            'edit.php?post_type=' . self::CPT,
            esc_html__('Generate Coloring Page', 'digital-coloring-pages'),
            esc_html__('Generate New', 'digital-coloring-pages'),
            'upload_files',
            'dcp-generate-page',
            [$this, 'render_admin_page']
        );
    }

    public function render_admin_page(): void
    {
        if (! current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to access this page.', 'digital-coloring-pages'));
        }
        ?>
        <div class="wrap dcp-admin-wrap">
            <h1><?php echo esc_html__('Digital Coloring Pages Generator', 'digital-coloring-pages'); ?></h1>
            <p><?php echo esc_html__('Select an image, generate a simplified black-outline version, then save it as a coloring page post.', 'digital-coloring-pages'); ?></p>

            <div class="dcp-admin-controls">
                <button type="button" class="button button-secondary" id="dcp-select-image"><?php echo esc_html__('Select / Upload Image', 'digital-coloring-pages'); ?></button>
                <input type="number" min="1" max="255" id="dcp-threshold" value="140" aria-label="<?php echo esc_attr__('Edge threshold', 'digital-coloring-pages'); ?>">
                <label for="dcp-threshold"><?php echo esc_html__('Edge Threshold', 'digital-coloring-pages'); ?></label>
                <button type="button" class="button" id="dcp-generate-outline"><?php echo esc_html__('Generate Outline', 'digital-coloring-pages'); ?></button>
            </div>

            <div class="dcp-admin-canvas-grid">
                <div>
                    <h2><?php echo esc_html__('Original', 'digital-coloring-pages'); ?></h2>
                    <canvas id="dcp-original-canvas" width="700" height="500"></canvas>
                </div>
                <div>
                    <h2><?php echo esc_html__('Generated Outline', 'digital-coloring-pages'); ?></h2>
                    <canvas id="dcp-outline-canvas" width="700" height="500"></canvas>
                </div>
            </div>

            <div class="dcp-save-block">
                <label for="dcp-page-title"><?php echo esc_html__('Coloring Page Title', 'digital-coloring-pages'); ?></label>
                <input id="dcp-page-title" type="text" class="regular-text" required>
                <button type="button" class="button button-primary" id="dcp-save-page"><?php echo esc_html__('Save Coloring Page', 'digital-coloring-pages'); ?></button>
                <p id="dcp-save-message" aria-live="polite"></p>
            </div>
        </div>
        <?php
    }

    public function enqueue_admin_assets(string $hook): void
    {
        if ('coloring-page_page_dcp-generate-page' !== $hook) {
            return;
        }

        wp_enqueue_media();

        wp_enqueue_style(
            'dcp-admin',
            plugin_dir_url(__FILE__) . 'assets/css/admin.css',
            [],
            '1.0.0'
        );

        wp_enqueue_script(
            'dcp-admin',
            plugin_dir_url(__FILE__) . 'assets/js/admin.js',
            [],
            '1.0.0',
            true
        );

        wp_localize_script(
            'dcp-admin',
            'dcpAdmin',
            [
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce(self::NONCE_ACTION_ADMIN),
                'messages' => [
                    'missingImage' => esc_html__('Please select an image first.', 'digital-coloring-pages'),
                    'missingOutline' => esc_html__('Generate an outline before saving.', 'digital-coloring-pages'),
                    'missingTitle' => esc_html__('Please enter a title.', 'digital-coloring-pages'),
                ],
            ]
        );
    }

    public function enqueue_front_assets(): void
    {
        wp_enqueue_style(
            'dcp-front',
            plugin_dir_url(__FILE__) . 'assets/css/front.css',
            [],
            '1.0.0'
        );

        wp_enqueue_script(
            'dcp-front',
            plugin_dir_url(__FILE__) . 'assets/js/front.js',
            [],
            '1.0.0',
            true
        );

        wp_localize_script(
            'dcp-front',
            'dcpFront',
            [
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce(self::NONCE_ACTION_FRONT),
            ]
        );
    }

    public function ajax_create_coloring_page(): void
    {
        if (! current_user_can('upload_files')) {
            wp_send_json_error(['message' => esc_html__('Insufficient permissions.', 'digital-coloring-pages')], 403);
        }

        check_ajax_referer(self::NONCE_ACTION_ADMIN, 'nonce');

        $title = isset($_POST['title']) ? sanitize_text_field(wp_unslash($_POST['title'])) : '';
        $original_id = isset($_POST['original_id']) ? absint($_POST['original_id']) : 0;
        $data_url = isset($_POST['outline_data']) ? wp_unslash($_POST['outline_data']) : '';

        if (! $title || ! $original_id || ! is_string($data_url) || 0 !== strpos($data_url, 'data:image/png;base64,')) {
            wp_send_json_error(['message' => esc_html__('Invalid request payload.', 'digital-coloring-pages')], 400);
        }

        $attachment = get_post($original_id);
        if (! $attachment || 'attachment' !== $attachment->post_type) {
            wp_send_json_error(['message' => esc_html__('Original image not found.', 'digital-coloring-pages')], 404);
        }

        $outline_attachment_id = $this->save_data_url_as_attachment($data_url, $title . '-outline.png');
        if (is_wp_error($outline_attachment_id)) {
            wp_send_json_error(['message' => $outline_attachment_id->get_error_message()], 500);
        }

        $post_id = wp_insert_post(
            [
                'post_title' => $title,
                'post_status' => 'publish',
                'post_type' => self::CPT,
            ],
            true
        );

        if (is_wp_error($post_id)) {
            wp_send_json_error(['message' => $post_id->get_error_message()], 500);
        }

        update_post_meta($post_id, self::META_ORIGINAL_ATTACHMENT, $original_id);
        update_post_meta($post_id, self::META_OUTLINE_ATTACHMENT, $outline_attachment_id);

        wp_send_json_success(
            [
                'postId' => $post_id,
                'editUrl' => get_edit_post_link($post_id, 'raw'),
                'shortcode' => '[digital_coloring_page id="' . $post_id . '"]',
            ]
        );
    }

    public function ajax_get_coloring_page(): void
    {
        check_ajax_referer(self::NONCE_ACTION_FRONT, 'nonce');

        $post_id = isset($_GET['post_id']) ? absint($_GET['post_id']) : 0;
        if (! $post_id) {
            wp_send_json_error(['message' => esc_html__('Missing coloring page ID.', 'digital-coloring-pages')], 400);
        }

        $post = get_post($post_id);
        if (! $post || self::CPT !== $post->post_type || 'publish' !== $post->post_status) {
            wp_send_json_error(['message' => esc_html__('Coloring page not found.', 'digital-coloring-pages')], 404);
        }

        $outline_id = absint(get_post_meta($post_id, self::META_OUTLINE_ATTACHMENT, true));
        if (! $outline_id) {
            wp_send_json_error(['message' => esc_html__('Outline image missing.', 'digital-coloring-pages')], 404);
        }

        $outline_url = wp_get_attachment_image_url($outline_id, 'full');
        if (! $outline_url) {
            wp_send_json_error(['message' => esc_html__('Outline image unavailable.', 'digital-coloring-pages')], 404);
        }

        wp_send_json_success(
            [
                'title' => get_the_title($post_id),
                'outlineUrl' => esc_url_raw($outline_url),
            ]
        );
    }

    public function render_shortcode(array $atts): string
    {
        $atts = shortcode_atts(
            [
                'id' => 0,
            ],
            $atts,
            'digital_coloring_page'
        );

        $post_id = absint($atts['id']);
        if (! $post_id && is_singular(self::CPT)) {
            $post_id = get_the_ID();
        }

        if (! $post_id) {
            return esc_html__('No coloring page selected.', 'digital-coloring-pages');
        }

        ob_start();
        ?>
        <div class="dcp-coloring-app" data-page-id="<?php echo esc_attr((string) $post_id); ?>">
            <div class="dcp-toolbar">
                <label for="dcp-brush-size-<?php echo esc_attr((string) $post_id); ?>"><?php echo esc_html__('Brush Size', 'digital-coloring-pages'); ?></label>
                <input type="range" min="1" max="40" value="8" class="dcp-brush-size" id="dcp-brush-size-<?php echo esc_attr((string) $post_id); ?>">
                <button type="button" class="dcp-tool" data-tool="brush"><?php echo esc_html__('Brush', 'digital-coloring-pages'); ?></button>
                <button type="button" class="dcp-tool" data-tool="bucket"><?php echo esc_html__('Bucket Fill', 'digital-coloring-pages'); ?></button>
                <button type="button" class="dcp-tool" data-tool="eraser"><?php echo esc_html__('Eraser', 'digital-coloring-pages'); ?></button>
                <button type="button" class="dcp-reset"><?php echo esc_html__('Reset', 'digital-coloring-pages'); ?></button>
                <button type="button" class="dcp-download"><?php echo esc_html__('Download', 'digital-coloring-pages'); ?></button>
            </div>
            <div class="dcp-palette" role="radiogroup" aria-label="<?php echo esc_attr__('Color palette', 'digital-coloring-pages'); ?>"></div>
            <canvas class="dcp-canvas" width="900" height="640"></canvas>
            <p class="dcp-message" aria-live="polite"></p>
        </div>
        <?php
        return (string) ob_get_clean();
    }

    private function save_data_url_as_attachment(string $data_url, string $filename)
    {
        $decoded = base64_decode(str_replace('data:image/png;base64,', '', $data_url), true);
        if (false === $decoded) {
            return new WP_Error('dcp_invalid_png', esc_html__('Could not decode outline image.', 'digital-coloring-pages'));
        }

        $upload = wp_upload_bits(sanitize_file_name($filename), null, $decoded);
        if (! empty($upload['error'])) {
            return new WP_Error('dcp_upload_error', sanitize_text_field($upload['error']));
        }

        $filetype = wp_check_filetype($upload['file']);
        $attachment_id = wp_insert_attachment(
            [
                'post_mime_type' => isset($filetype['type']) ? $filetype['type'] : 'image/png',
                'post_title' => sanitize_text_field(pathinfo($filename, PATHINFO_FILENAME)),
                'post_status' => 'inherit',
            ],
            $upload['file']
        );

        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        require_once ABSPATH . 'wp-admin/includes/image.php';
        $metadata = wp_generate_attachment_metadata($attachment_id, $upload['file']);
        wp_update_attachment_metadata($attachment_id, $metadata);

        return $attachment_id;
    }
}

new Digital_Coloring_Pages_Plugin();

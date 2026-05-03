{
  description = "Local PostgreSQL for otography-app (Supabase-compatible)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        postgresql = pkgs.postgresql_15.withPackages (ps: [ pkgs.postgresql_15 ps.pg_uuidv7 ]);
        port = "54322";
        dataDir = ".data/postgres";
        confFile = ./nix/postgresql.conf;
        initFile = ./nix/init.sql;

        # confとinitをNix storeにコピーして、store pathを正しく参照する
        confInStore = pkgs.runCommandLocal "postgresql.conf" { } ''
          cp ${confFile} $out
        '';
        initInStore = pkgs.runCommandLocal "init.sql" { } ''
          cp ${initFile} $out
        '';

        startScript = pkgs.writeShellScript "db-start" ''
          set -euo pipefail

          DATA_DIR="${dataDir}"
          CONF_FILE="${confInStore}"
          INIT_FILE="${initInStore}"
          PORT="${port}"
          PID_FILE="$DATA_DIR/postmaster.pid"

          # データディレクトリ初期化
          if [ ! -d "$DATA_DIR" ]; then
            echo "Initializing PostgreSQL data directory..."
            mkdir -p "$DATA_DIR"
            ${postgresql}/bin/initdb \
              --auth=trust \
              --username=postgres \
              --locale=en_US.UTF-8 \
              --encoding=UTF8 \
              "$DATA_DIR" > /dev/null
            echo "Data directory initialized."
          fi

          # 起動済みチェック
          if [ -f "$PID_FILE" ] && kill -0 $(head -1 "$PID_FILE") 2>/dev/null; then
            echo "PostgreSQL is already running on port $PORT"
            exit 0
          fi

          # 起動
          echo "Starting PostgreSQL on port $PORT..."
          ${postgresql}/bin/pg_ctl \
            -D "$DATA_DIR" \
            -o "-c config_file=$CONF_FILE -p $PORT" \
            -l "$DATA_DIR/postgresql.log" \
            start

          # init.sqlを流す
          until ${postgresql}/bin/pg_isready -h localhost -p "$PORT" -U postgres > /dev/null 2>&1; do
            sleep 0.5
          done

          ${postgresql}/bin/psql \
            -h localhost -p "$PORT" -U postgres \
            -f "$INIT_FILE" > /dev/null 2>&1 || true

          echo "PostgreSQL started on port $PORT"
        '';

        stopScript = pkgs.writeShellScript "db-stop" ''
          set -euo pipefail

          DATA_DIR="${dataDir}"
          PID_FILE="$DATA_DIR/postmaster.pid"

          if [ ! -f "$PID_FILE" ]; then
            echo "PostgreSQL is not running."
            exit 0
          fi

          echo "Stopping PostgreSQL..."
          ${postgresql}/bin/pg_ctl \
            -D "$DATA_DIR" \
            -m fast \
            stop
          echo "PostgreSQL stopped."
        '';

        resetScript = pkgs.writeShellScript "db-reset" ''
          set -euo pipefail

          DATA_DIR="${dataDir}"

          # 停止
          if [ -f "$DATA_DIR/postmaster.pid" ]; then
            echo "Stopping PostgreSQL..."
            ${postgresql}/bin/pg_ctl \
              -D "$DATA_DIR" \
              -m fast \
              stop 2>/dev/null || true
          fi

          # データ削除
          echo "Resetting database..."
          rm -rf "$DATA_DIR"
          echo "Database reset complete. Run 'db-start' to reinitialize."
        '';

        psqlScript = pkgs.writeShellScript "db-psql" ''
          set -euo pipefail
          exec ${postgresql}/bin/psql \
            -h localhost -p ${port} -U postgres "$@"
        '';
      in
      {
        apps = {
          db-start = { type = "app"; program = toString startScript; };
          db-stop = { type = "app"; program = toString stopScript; };
          db-reset = { type = "app"; program = toString resetScript; };
          db-psql = { type = "app"; program = toString psqlScript; };
        };
      }
    );
}

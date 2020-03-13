#!/usr/bin/env bash
# This allows you to run any command inside of our built docker container with an ephemeral database
# It ensures running code is fresh and cleaned up afterwards

set -e

function clear_lines() {
  local end=$1
  while [ $end -gt 0 ]; do
    tput cuu 1
    tput el
    end=$(($end-1))
  done
}

function compose() {
  docker-compose -p cord "$@"
}

function pull() {
  # shellcheck disable=SC2068
  compose pull $@
  clear_lines 1
}

function build() {
  # Ensure there is 5 lines below
  printf '\n\n\n\n\n' && tput cuu 5
  # shellcheck disable=SC2068
  compose build $@ | tail -n 5
  clear_lines 6
}

function run() {
  # shellcheck disable=SC2068
  compose run --rm api $@ 2>/dev/null
}

function down() {
  compose down --remove-orphans 2>/dev/null
}

pull db
build api
trap down EXIT
run "${*:-yarn start:prod}"

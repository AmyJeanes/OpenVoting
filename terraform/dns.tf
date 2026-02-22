data "cloudflare_zone" "main" {
  zone_id = var.cloudflare_zone_id
}

resource "cloudflare_dns_record" "main" {
  zone_id = var.cloudflare_zone_id
  name    = "shipyard-voting.${data.cloudflare_zone.main.name}"
  type    = "CNAME"
  content = "home.${data.cloudflare_zone.main.name}"
  ttl     = 1
  proxied = true
}

output "storage_account_name" {
	value = azurerm_storage_account.assets.name
}

output "storage_container_name" {
	value = azurerm_storage_container.assets.name
}

output "storage_blob_base_url" {
	value = "${azurerm_storage_account.assets.primary_blob_endpoint}${azurerm_storage_container.assets.name}"
}

output "storage_connection_string" {
	value     = azurerm_storage_account.assets.primary_connection_string
	sensitive = true
}

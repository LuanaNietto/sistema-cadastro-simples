alasql.options.autocommit = true;
alasql.options.modifier = 'localStorage';

function initDatabase() {

    alasql(`CREATE TABLE IF NOT EXISTS users (
        id INT IDENTITY PRIMARY KEY,
        name STRING,
        email STRING,
        password STRING,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    alasql(`CREATE TABLE IF NOT EXISTS clients (
        id INT IDENTITY PRIMARY KEY,
        name STRING,
        cpf STRING,
        birth_date DATE,
        phone STRING,
        mobile STRING,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    alasql(`CREATE TABLE IF NOT EXISTS addresses (
        id INT IDENTITY PRIMARY KEY,
        client_id INT,
        cep STRING,
        street STRING,
        number STRING,
        complement STRING,
        neighborhood STRING,
        city STRING,
        state STRING,
        country STRING,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

let currentUser = null;
let currentEditingClient = null;
let currentEditingAddress = null;

const Utils = {

    formatCPF: function(value) {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    },

    formatPhone: function(value) {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .replace(/(\d{4})(\d)/, '$1$2-$3')
            .replace(/(-\d{4})\d+?$/, '$1');
    },

    formatCEP: function(value) {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .replace(/(-\d{3})\d+?$/, '$1');
    },

    validateCPF: function(cpf) {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11) return false;
        
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let remainder = 11 - (sum % 11);
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(9))) return false;
        
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cpf.charAt(i)) * (11 - i);
        }
        remainder = 11 - (sum % 11);
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(10))) return false;
        
        return true;
    },

    validateEmail: function(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    formatDate: function(date) {
        if (!date) return '';
        return new Date(date).toLocaleDateString('pt-BR');
    },

    showToast: function(message, type = 'info', title = 'Notificação') {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        const toastTitle = document.getElementById('toastTitle');
        const toastBody = document.getElementById('toastBody');
        
        const types = {
            success: { icon: 'fas fa-check-circle', class: 'text-success' },
            error: { icon: 'fas fa-exclamation-triangle', class: 'text-danger' },
            warning: { icon: 'fas fa-exclamation-circle', class: 'text-warning' },
            info: { icon: 'fas fa-info-circle', class: 'text-primary' }
        };
        
        const typeConfig = types[type] || types.info;
        toastIcon.className = `${typeConfig.icon} ${typeConfig.class} me-2`;
        toastTitle.textContent = title;
        toastBody.textContent = message;
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
};

const Auth = {

    login: function(email, password) {
        try {
            const users = alasql('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
            
            if (users.length > 0) {
                currentUser = users[0];
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                this.showMainApp();
                Utils.showToast('Login realizado com sucesso!', 'success');
                return true;
            } else {
                Utils.showToast('Email ou senha inválidos!', 'error');
                return false;
            }
        } catch (error) {
            console.error('Erro no login:', error);
            Utils.showToast('Erro interno do sistema', 'error');
            return false;
        }
    },

    register: function(name, email, password) {
        try {
            const existingUsers = alasql('SELECT * FROM users WHERE email = ?', [email]);
            if (existingUsers.length > 0) {
                Utils.showToast('Já existe um usuário com este email!', 'error');
                return false;
            }

            alasql('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, password]);
            Utils.showToast('Usuário cadastrado com sucesso!', 'success');
            return true;
        } catch (error) {
            console.error('Erro no cadastro:', error);
            Utils.showToast('Erro interno do sistema', 'error');
            return false;
        }
    },

    logout: function() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        this.showAuthContainer();
        Utils.showToast('Logout realizado com sucesso!', 'success');
    },

    showAuthContainer: function() {
        document.getElementById('auth-container').classList.remove('d-none');
        document.getElementById('main-container').classList.add('d-none');
    },

    showMainApp: function() {
        document.getElementById('auth-container').classList.add('d-none');
        document.getElementById('main-container').classList.remove('d-none');
        document.getElementById('userName').textContent = currentUser.name;
        
        Clients.loadClients();
        Addresses.loadAddresses();
        Addresses.loadClientOptions();
    },

    checkAuth: function() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            this.showMainApp();
        } else {
            this.showAuthContainer();
        }
    }
};

const Clients = {
    loadClients: function() {
        try {
            const clients = alasql('SELECT * FROM clients ORDER BY name');
            const tbody = document.getElementById('clientsTableBody');
            
            if (clients.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted py-4">
                            <div class="empty-state">
                                <i class="fas fa-users"></i>
                                <h5>Nenhum cliente cadastrado</h5>
                                <p>Clique em "Novo Cliente" para começar</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = clients.map(client => `
                <tr>
                    <td>${client.name}</td>
                    <td>${client.cpf}</td>
                    <td>${Utils.formatDate(client.birth_date)}</td>
                    <td>${client.phone || '-'}</td>
                    <td>${client.mobile}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="Clients.editClient(${client.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="Clients.deleteClient(${client.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            Utils.showToast('Erro ao carregar clientes', 'error');
        }
    },

    openModal: function() {
        currentEditingClient = null;
        document.getElementById('clientModalTitle').textContent = 'Novo Cliente';
        document.getElementById('clientForm').reset();
        document.getElementById('clientId').value = '';
        
        const modal = new bootstrap.Modal(document.getElementById('clientModal'));
        modal.show();
    },

    editClient: function(clientId) {
        try {
            const clients = alasql('SELECT * FROM clients WHERE id = ?', [clientId]);
            if (clients.length === 0) {
                Utils.showToast('Cliente não encontrado', 'error');
                return;
            }
            
            const client = clients[0];
            currentEditingClient = client;
            
            document.getElementById('clientModalTitle').textContent = 'Editar Cliente';
            document.getElementById('clientId').value = client.id;
            document.getElementById('clientName').value = client.name;
            document.getElementById('clientCpf').value = client.cpf;
            document.getElementById('clientBirthDate').value = client.birth_date;
            document.getElementById('clientPhone').value = client.phone || '';
            document.getElementById('clientMobile').value = client.mobile;
            
            const modal = new bootstrap.Modal(document.getElementById('clientModal'));
            modal.show();
        } catch (error) {
            console.error('Erro ao editar cliente:', error);
            Utils.showToast('Erro ao carregar dados do cliente', 'error');
        }
    },

    saveClient: function() {
        try {            
            const clientData = {
                name: document.getElementById('clientName').value.trim(),
                cpf: document.getElementById('clientCpf').value.trim(),
                birth_date: document.getElementById('clientBirthDate').value,
                phone: document.getElementById('clientPhone').value.trim(),
                mobile: document.getElementById('clientMobile').value.trim()
            };
            
            if (!clientData.name || !clientData.cpf || !clientData.birth_date || !clientData.mobile) {
                Utils.showToast('Por favor, preencha todos os campos obrigatórios', 'error');
                return;
            }
            
            if (!Utils.validateCPF(clientData.cpf)) {
                Utils.showToast('CPF inválido', 'error');
                return;
            }
            
            const clientId = document.getElementById('clientId').value;
            
            if (clientId) {
                alasql('UPDATE clients SET name = ?, cpf = ?, birth_date = ?, phone = ?, mobile = ? WHERE id = ?', 
                    [clientData.name, clientData.cpf, clientData.birth_date, clientData.phone, clientData.mobile, clientId]);
                Utils.showToast('Cliente atualizado com sucesso!', 'success');
            } else {
                const existingClients = alasql('SELECT * FROM clients WHERE cpf = ?', [clientData.cpf]);
                if (existingClients.length > 0) {
                    Utils.showToast('Já existe um cliente com este CPF!', 'error');
                    return;
                }
                
                alasql('INSERT INTO clients (name, cpf, birth_date, phone, mobile) VALUES (?, ?, ?, ?, ?)', 
                    [clientData.name, clientData.cpf, clientData.birth_date, clientData.phone, clientData.mobile]);
                Utils.showToast('Cliente cadastrado com sucesso!', 'success');
            }
            const modal = bootstrap.Modal.getInstance(document.getElementById('clientModal'));
            modal.hide();
            
            this.loadClients();
            Addresses.loadClientOptions();
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            Utils.showToast('Erro ao salvar cliente', 'error');
        }
    },

    deleteClient: function(clientId) {
        if (!confirm('Tem certeza que deseja excluir este cliente? Esta ação também removerá todos os endereços associados.')) {
            return;
        }
        
        try {
            alasql('DELETE FROM addresses WHERE client_id = ?', [clientId]);
            
            alasql('DELETE FROM clients WHERE id = ?', [clientId]);
            
            Utils.showToast('Cliente excluído com sucesso!', 'success');
            this.loadClients();
            Addresses.loadAddresses();
            Addresses.loadClientOptions();
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
            Utils.showToast('Erro ao excluir cliente', 'error');
        }
    }
};

const Addresses = {
    loadAddresses: function() {
        try {
            const query = `
                SELECT a.*, c.name as client_name 
                FROM addresses a 
                JOIN clients c ON a.client_id = c.id 
                ORDER BY c.name, a.is_primary DESC
            `;
            const addresses = alasql(query);
            
            const tbody = document.getElementById('addressesTableBody');
            
            if (addresses.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-muted py-4">
                            <div class="empty-state">
                                <i class="fas fa-map-marker-alt"></i>
                                <h5>Nenhum endereço cadastrado</h5>
                                <p>Clique em "Novo Endereço" para começar</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = addresses.map(address => `
                <tr>
                    <td>${address.client_name}</td>
                    <td>${address.cep}</td>
                    <td>${address.street}, ${address.number}${address.complement ? ' - ' + address.complement : ''}</td>
                    <td>${address.neighborhood}</td>
                    <td>${address.city}</td>
                    <td>${address.state}</td>
                    <td>
                        <span class="badge ${address.is_primary ? 'bg-success' : 'bg-secondary'}">
                            ${address.is_primary ? 'Principal' : 'Secundário'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="Addresses.editAddress(${address.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="Addresses.deleteAddress(${address.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Erro ao carregar endereços:', error);
            Utils.showToast('Erro ao carregar endereços', 'error');
        }
    },

    loadClientOptions: function() {
        try {
            const clients = alasql('SELECT * FROM clients ORDER BY name');
            const selects = ['addressClient', 'clientFilter'];
            
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (select) {
                    const currentValue = select.value;
                    
                    if (selectId === 'clientFilter') {
                        select.innerHTML = '<option value="">Todos os clientes</option>';
                    } else {
                        select.innerHTML = '<option value="">Selecione um cliente</option>';
                    }
                    
                    clients.forEach(client => {
                        const option = document.createElement('option');
                        option.value = client.id;
                        option.textContent = `${client.name} - ${client.cpf}`;
                        select.appendChild(option);
                    });
                    
                    select.value = currentValue;
                }
            });
        } catch (error) {
            console.error('Erro ao carregar opções de clientes:', error);
        }
    },

    filterAddresses: function() {
        const clientId = document.getElementById('clientFilter').value;
        
        try {
            let query = `
                SELECT a.*, c.name as client_name 
                FROM addresses a 
                JOIN clients c ON a.client_id = c.id 
            `;
            
            let params = [];
            if (clientId) {
                query += ' WHERE a.client_id = ?';
                params.push(parseInt(clientId));
            }
            
            query += ' ORDER BY c.name, a.is_primary DESC';
            
            const addresses = alasql(query, params);
            const tbody = document.getElementById('addressesTableBody');
            
            if (addresses.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-muted py-4">
                            <div class="empty-state">
                                <i class="fas fa-map-marker-alt"></i>
                                <h5>Nenhum endereço encontrado</h5>
                                <p>Tente selecionar outro cliente</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = addresses.map(address => `
                <tr>
                    <td>${address.client_name}</td>
                    <td>${address.cep}</td>
                    <td>${address.street}, ${address.number}${address.complement ? ' - ' + address.complement : ''}</td>
                    <td>${address.neighborhood}</td>
                    <td>${address.city}</td>
                    <td>${address.state}</td>
                    <td>
                        <span class="badge ${address.is_primary ? 'bg-success' : 'bg-secondary'}">
                            ${address.is_primary ? 'Principal' : 'Secundário'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="Addresses.editAddress(${address.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="Addresses.deleteAddress(${address.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Erro ao filtrar endereços:', error);
            Utils.showToast('Erro ao filtrar endereços', 'error');
        }
    },

    openModal: function() {
        currentEditingAddress = null;
        document.getElementById('addressModalTitle').textContent = 'Novo Endereço';
        document.getElementById('addressForm').reset();
        document.getElementById('addressId').value = '';
        document.getElementById('addressCountry').value = 'Brasil';
        
        const modal = new bootstrap.Modal(document.getElementById('addressModal'));
        modal.show();
    },

    editAddress: function(addressId) {
        try {
            const addresses = alasql('SELECT * FROM addresses WHERE id = ?', [addressId]);
            if (addresses.length === 0) {
                Utils.showToast('Endereço não encontrado', 'error');
                return;
            }
            
            const address = addresses[0];
            currentEditingAddress = address;
            
            document.getElementById('addressModalTitle').textContent = 'Editar Endereço';
            document.getElementById('addressId').value = address.id;
            document.getElementById('addressClient').value = address.client_id;
            document.getElementById('addressCep').value = address.cep;
            document.getElementById('addressStreet').value = address.street;
            document.getElementById('addressNumber').value = address.number;
            document.getElementById('addressComplement').value = address.complement || '';
            document.getElementById('addressNeighborhood').value = address.neighborhood;
            document.getElementById('addressCity').value = address.city;
            document.getElementById('addressState').value = address.state;
            document.getElementById('addressCountry').value = address.country;
            document.getElementById('addressPrimary').checked = address.is_primary;
            
            const modal = new bootstrap.Modal(document.getElementById('addressModal'));
            modal.show();
        } catch (error) {
            console.error('Erro ao editar endereço:', error);
            Utils.showToast('Erro ao carregar dados do endereço', 'error');
        }
    },

    searchCep: async function() {
        const cep = document.getElementById('addressCep').value.replace(/\D/g, '');
        
        if (cep.length !== 8) {
            Utils.showToast('CEP deve ter 8 dígitos', 'error');
            return;
        }
        
        const button = event.target;
        const originalContent = button.innerHTML;
        button.classList.add('loading');
        button.disabled = true;
        
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (data.erro) {
                throw new Error('CEP não encontrado');
            }
            
            document.getElementById('addressStreet').value = data.logradouro;
            document.getElementById('addressNeighborhood').value = data.bairro;
            document.getElementById('addressCity').value = data.localidade;
            document.getElementById('addressState').value = data.uf;
            document.getElementById('addressCountry').value = 'Brasil';
            
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            Utils.showToast('CEP não encontrado', 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
            button.innerHTML = originalContent;
        }
    },

    saveAddress: function() {
        try {
            const addressData = {
                client_id: parseInt(document.getElementById('addressClient').value),
                cep: document.getElementById('addressCep').value.trim(),
                street: document.getElementById('addressStreet').value.trim(),
                number: document.getElementById('addressNumber').value.trim(),
                complement: document.getElementById('addressComplement').value.trim(),
                neighborhood: document.getElementById('addressNeighborhood').value.trim(),
                city: document.getElementById('addressCity').value.trim(),
                state: document.getElementById('addressState').value.trim(),
                country: document.getElementById('addressCountry').value.trim(),
                is_primary: document.getElementById('addressPrimary').checked
            };
       
            if (!addressData.client_id || !addressData.cep || !addressData.street || 
                !addressData.number || !addressData.neighborhood || !addressData.city || 
                !addressData.state || !addressData.country) {
                Utils.showToast('Por favor, preencha todos os campos obrigatórios', 'error');
                return;
            }
            
            const addressId = document.getElementById('addressId').value;

            if(addressData.client_id > 0){
                const clientPrimaryAddresses = alasql('SELECT * FROM addresses WHERE client_id = ? AND is_primary = true', [addressData.client_id]);

                if (!addressData.is_primary && clientPrimaryAddresses.length === 0) {
                    Utils.showToast('É obrigatório que o cliente tenha ao menos um endereço principal.', 'error');
                    return;
                }    
            }
            
            if (addressData.is_primary) {
                let updateQuery = 'UPDATE addresses SET is_primary = false WHERE client_id = ?';
                let params = [addressData.client_id];
                
                if (addressId) {
                    updateQuery += ' AND id != ?';
                    params.push(addressId);
                }
                
                alasql(updateQuery, params);
            }
            
            if (addressId) {
                alasql(`UPDATE addresses SET 
                    client_id = ?, cep = ?, street = ?, number = ?, complement = ?, 
                    neighborhood = ?, city = ?, state = ?, country = ?, is_primary = ? 
                    WHERE id = ?`, 
                    [addressData.client_id, addressData.cep, addressData.street, addressData.number,
                     addressData.complement, addressData.neighborhood, addressData.city, addressData.state,
                     addressData.country, addressData.is_primary, addressId]);
                Utils.showToast('Endereço atualizado com sucesso!', 'success');
            } else {
                alasql(`INSERT INTO addresses 
                    (client_id, cep, street, number, complement, neighborhood, city, state, country, is_primary) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [addressData.client_id, addressData.cep, addressData.street, addressData.number,
                     addressData.complement, addressData.neighborhood, addressData.city, addressData.state,
                     addressData.country, addressData.is_primary]);
                Utils.showToast('Endereço cadastrado com sucesso!', 'success');
            }
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('addressModal'));
            modal.hide();
            
            this.loadAddresses();
        } catch (error) {
            console.error('Erro ao salvar endereço:', error);
            Utils.showToast('Erro ao salvar endereço', 'error');
        }
    },

    deleteAddress: function(addressId) {
        if (!confirm('Tem certeza que deseja excluir este endereço?')) {
            return;
        }
        
        try {
            alasql('DELETE FROM addresses WHERE id = ?', [addressId]);
            Utils.showToast('Endereço excluído com sucesso!', 'success');
            this.loadAddresses();
        } catch (error) {
            console.error('Erro ao excluir endereço:', error);
            Utils.showToast('Erro ao excluir endereço', 'error');
        }
    }
};

const Settings = {
    exportData: function() {
        try {
            const data = {
                users: alasql('SELECT * FROM users'),
                clients: alasql('SELECT * FROM clients'),
                addresses: alasql('SELECT * FROM addresses'),
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sistema_cadastro_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            Utils.showToast('Dados exportados com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            Utils.showToast('Erro ao exportar dados', 'error');
        }
    },

    importData: function() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        
        if (!file) {
            Utils.showToast('Por favor, selecione um arquivo JSON', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);

                const prevAutocommit = alasql.options.autocommit;
                alasql.options.autocommit = false;

                alasql('DELETE FROM addresses');
                alasql('DELETE FROM clients');
                alasql('DELETE FROM users');
                
                if (data.users && data.users.length > 0) {
                    data.users.forEach(user => {
                        alasql('INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)',
                            [user.name, user.email, user.password, user.created_at]);
                    });
                }
                
                if (data.clients && data.clients.length > 0) {
                    data.clients.forEach(client => {
                        alasql('INSERT INTO clients (name, cpf, birth_date, phone, mobile, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [client.name, client.cpf, client.birth_date, client.phone, client.mobile, client.created_at]);
                    });
                }
                
                if (data.addresses && data.addresses.length > 0) {
                    data.addresses.forEach(address => {
                        alasql(`INSERT INTO addresses 
                            (client_id, cep, street, number, complement, neighborhood, city, state, country, is_primary, created_at) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [address.client_id, address.cep, address.street, address.number, address.complement,
                             address.neighborhood, address.city, address.state, address.country, address.is_primary, address.created_at]);
                    });
                }
                alasql.options.autocommit = prevAutocommit;
                
                Clients.loadClients();
                Addresses.loadAddresses();
                Addresses.loadClientOptions();
                
                Utils.showToast('Dados importados com sucesso!', 'success');
                fileInput.value = '';
            } catch (error) {
                console.error('Erro ao importar dados:', error);
                Utils.showToast('Erro ao processar arquivo JSON', 'error');
            }
        };
        
        reader.readAsText(file);
    },

    loadSampleData: function() {
        if (!confirm('Isso substituirá todos os dados existentes. Deseja continuar?')) {
            return;
        }
        
        try {
            alasql('DELETE FROM addresses');
            alasql('DELETE FROM clients');
            alasql('DELETE FROM users');
            
            const sampleData = {
                users: [
                    { name: 'Administrador', email: 'admin@sistema.com', password: 'admin123' },
                    { name: 'João Silva', email: 'joao@email.com', password: '123456' }
                ],
                clients: [
                    { name: 'Maria Santos', cpf: '123.456.789-00', birth_date: '1990-01-15', phone: '(11) 1234-5678', mobile: '(11) 91234-5678' },
                    { name: 'Pedro Oliveira', cpf: '987.654.321-00', birth_date: '1985-05-20', phone: '(11) 8765-4321', mobile: '(11) 98765-4321' },
                    { name: 'Ana Costa', cpf: '456.789.123-00', birth_date: '1992-10-10', phone: '', mobile: '(11) 95555-5555' }
                ],
                addresses: [
                    { client_id: 1, cep: '01310-100', street: 'Av. Paulista', number: '1000', complement: 'Apto 101', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', country: 'Brasil', is_primary: true },
                    { client_id: 1, cep: '04038-001', street: 'Rua Vergueiro', number: '2000', complement: '', neighborhood: 'Vila Mariana', city: 'São Paulo', state: 'SP', country: 'Brasil', is_primary: false },
                    { client_id: 2, cep: '22071-900', street: 'Av. Atlântica', number: '500', complement: 'Cobertura', neighborhood: 'Copacabana', city: 'Rio de Janeiro', state: 'RJ', country: 'Brasil', is_primary: true },
                    { client_id: 3, cep: '40070-110', street: 'Rua Chile', number: '123', complement: '', neighborhood: 'Centro', city: 'Salvador', state: 'BA', country: 'Brasil', is_primary: true }
                ]
            };
            
            sampleData.users.forEach(user => {
                alasql('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                    [user.name, user.email, user.password]);
            });
            
            sampleData.clients.forEach(client => {
                alasql('INSERT INTO clients (name, cpf, birth_date, phone, mobile) VALUES (?, ?, ?, ?, ?)',
                    [client.name, client.cpf, client.birth_date, client.phone, client.mobile]);
            });
            
            sampleData.addresses.forEach(address => {
                alasql(`INSERT INTO addresses 
                    (client_id, cep, street, number, complement, neighborhood, city, state, country, is_primary) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [address.client_id, address.cep, address.street, address.number, address.complement,
                     address.neighborhood, address.city, address.state, address.country, address.is_primary]);
            });
            
            Clients.loadClients();
            Addresses.loadAddresses();
            Addresses.loadClientOptions();
            
            Utils.showToast('Dados de exemplo carregados com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao carregar dados de exemplo:', error);
            Utils.showToast('Erro ao carregar dados de exemplo', 'error');
        }
    },

    clearAllData: function() {
        if (!confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        try {
            alasql('DELETE FROM addresses');
            alasql('DELETE FROM clients');
            alasql('DELETE FROM users');
            
            localStorage.removeItem('currentUser');
            
            Utils.showToast('Todos os dados foram limpos!', 'success');
            
            setTimeout(() => {
                location.reload();
            }, 1000);
        } catch (error) {
            console.error('Erro ao limpar dados:', error);
            Utils.showToast('Erro ao limpar dados', 'error');
        }
    }
};

function showSection(section) {
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    event.target.classList.add('active');
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('d-none');
    });
    
    document.getElementById(section + '-section').classList.remove('d-none');
}

function logout() {
    Auth.logout();
}

function openClientModal() {
    Clients.openModal();
}

function saveClient() {
    Clients.saveClient();
}

function openAddressModal() {
    Addresses.openModal();
}

function saveAddress() {
    Addresses.saveAddress();
}

function searchCep() {
    Addresses.searchCep();
}

function filterAddresses() {
    Addresses.filterAddresses();
}

function exportData() {
    Settings.exportData();
}

function importData() {
    Settings.importData();
}

function loadSampleData() {
    Settings.loadSampleData();
}

function clearAllData() {
    Settings.clearAllData();
}

document.addEventListener('DOMContentLoaded', function() {
    initDatabase();
    
    Auth.checkAuth();
    
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (Auth.login(email, password)) {
            this.reset();
        }
    });
    
    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            Utils.showToast('As senhas não coincidem', 'error');
            return;
        }
        
        if (password.length < 6) {
            Utils.showToast('A senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }
        
        if (Auth.register(name, email, password)) {
            this.reset();
            document.getElementById('login-tab').click();
        }
    });
    
    document.getElementById('clientCpf').addEventListener('input', function(e) {
        e.target.value = Utils.formatCPF(e.target.value);
    });
    
    document.getElementById('clientPhone').addEventListener('input', function(e) {
        e.target.value = Utils.formatPhone(e.target.value);
    });
    
    document.getElementById('clientMobile').addEventListener('input', function(e) {
        e.target.value = Utils.formatPhone(e.target.value);
    });
    
    document.getElementById('addressCep').addEventListener('input', function(e) {
        e.target.value = Utils.formatCEP(e.target.value);
    });
    
    document.getElementById('addressCep').addEventListener('blur', function(e) {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            Addresses.searchCep();
        }
    });
});
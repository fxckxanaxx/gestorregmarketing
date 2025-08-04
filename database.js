const SUPABASE_URL = 'https://prjdumpcazszzgvcxmbl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByamR1bXBjYXpzenpndmN4bWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzQ5MTUsImV4cCI6MjA2OTgxMDkxNX0.4Z80AcMx1u9oLJ2D5R64624gYEYxN-K5mtx71T-w6ms';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class Database {
    static async getAllProducts() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo productos:', error);
            return [];
        }
    }

    static async addProduct(productData) {
        try {
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    client_name: productData.clientName,
                    product_type: productData.productType,
                    quantity: productData.quantity,
                    quantity_completed: 0,
                    size: productData.size,
                    color: productData.color,
                    status: productData.status,
                    due_date: productData.dueDate,
                    price: productData.price,
                    notes: productData.notes
                }])
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error agregando producto:', error);
            throw error;
        }
    }

    static async updateProduct(id, productData) {
        try {
            const { data, error } = await supabase
                .from('products')
                .update({
                    client_name: productData.clientName,
                    product_type: productData.productType,
                    quantity: productData.quantity,
                    size: productData.size,
                    color: productData.color,
                    status: productData.status,
                    due_date: productData.dueDate,
                    price: productData.price,
                    notes: productData.notes
                })
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error actualizando producto:', error);
            throw error;
        }
    }

    static async deleteProduct(id) {
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error eliminando producto:', error);
            throw error;
        }
    }

    static async updateProgress(id, quantityCompleted, notes = '') {
        try {
            const { data: product, error: fetchError } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();
            
            if (fetchError) throw fetchError;

            const newQuantityCompleted = product.quantity_completed + quantityCompleted;
            const newStatus = newQuantityCompleted >= product.quantity ? 'completed' : product.status;

            const { data, error } = await supabase
                .from('products')
                .update({
                    quantity_completed: newQuantityCompleted,
                    status: newStatus
                })
                .eq('id', id)
                .select();
            
            if (error) throw error;

            await supabase
                .from('progress_history')
                .insert([{
                    product_id: id,
                    quantity_added: quantityCompleted,
                    quantity_before: product.quantity_completed,
                    quantity_after: newQuantityCompleted,
                    notes: notes
                }]);

            return data[0];
        } catch (error) {
            console.error('Error actualizando progreso:', error);
            throw error;
        }
    }
static async archiveProduct(id, action, completedDate = null) {
    try {
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Error obteniendo producto:', fetchError);
            throw fetchError;
        }

        if (!product) {
            throw new Error('Producto no encontrado');
        }

        const finalCompletedDate = completedDate || new Date().toISOString().split('T')[0];
        
        const { error: insertError } = await supabase
            .from('sales_history')
            .insert([{
                original_product_id: id,
                client_name: product.client_name,
                product_type: product.product_type,
                quantity: product.quantity,
                quantity_completed: product.quantity_completed,
                price: product.price,
                total_value: product.price * product.quantity_completed,
                due_date: product.due_date,
                completed_date: finalCompletedDate,
                action: action,
                archived_at: new Date().toISOString()
            }]);

        if (insertError) {
            console.error('Error insertando en historial:', insertError);
            throw insertError;
        }

        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error eliminando producto:', deleteError);
            throw deleteError;
        }

        console.log('Producto archivado correctamente:', { id, action, client: product.client_name });
        return true;

    } catch (error) {
        console.error('Error completo en archiveProduct:', error);
        throw error;
    }
}

static async getSalesHistory(limit = 50) {
    try {
        const { data, error } = await supabase
            .from('sales_history')
            .select('*')
            .order('archived_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('Error obteniendo historial:', error);
            throw error;
        }
        
        return data || [];
    } catch (error) {
        console.error('Error en getSalesHistory:', error);
        return [];
    }
}

static async getMonthlyReport(year, month) {
    try {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = month === 12 
            ? `${year + 1}-01-01` 
            : `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

        const { data, error } = await supabase
            .from('sales_history')
            .select('*')
            .gte('archived_at', startDate)
            .lt('archived_at', endDate)
            .order('archived_at', { ascending: false });
        
        if (error) {
            console.error('Error obteniendo reporte mensual:', error);
            throw error;
        }
        
        return data || [];
    } catch (error) {
        console.error('Error en getMonthlyReport:', error);
        return [];
    }
}

static async clearAllHistory() {
    try {
        const { error } = await supabase
            .from('sales_history')
            .delete()
            .neq('id', 0);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error limpiando historial:', error);
        throw error;
    }
}

}

import foodModel from "../models/foodModel.js";
import fs from "fs";

const addFood = async (req, res) => {
  try {
    const {
      sku, name, description, price, category,
      nameVI, nameEN, nameHU,
      isPromotion, promotionPrice,
      soldCount, quantity, slug, options,
      availableFrom, availableTo,
      dailyAvailabilityEnabled, dailyTimeFrom, dailyTimeTo
      // slug có thể để trống để model tự tạo
    } = req.body;

    // DEBUG: Log time-based fields
    console.log('🔍 TIME FIELDS DEBUG:', {
      availableFrom,
      availableTo,
      dailyAvailabilityEnabled,
      dailyTimeFrom,
      dailyTimeTo
    });

    if (!sku?.trim()) return res.status(400).json({ success: false, message: "SKU is required" });
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });
    if (price === undefined || price === null || isNaN(Number(price)))
      return res.status(400).json({ success: false, message: "Valid price is required" });
    if (!category?.trim())
      return res.status(400).json({ success: false, message: "Category is required" });
    if (quantity === undefined || quantity === null || isNaN(Number(quantity)) || Number(quantity) < 0)
      return res.status(400).json({ success: false, message: "Valid quantity is required (must be >= 0)" });

    // Store Cloudinary URL or local filename for server-side uploads
    const image_url = req.file ? (req.file.path || req.file.filename) : "";

    const isPromotionBool =
      isPromotion === true || isPromotion === "true" || isPromotion === 1 || isPromotion === "1";

    const doc = new foodModel({
      sku: sku.trim(),
      name: name.trim(),
      nameVI: nameVI?.trim(),
      nameEN: nameEN?.trim(),
      nameHU: nameHU?.trim(),
      // Only set slug if provided, otherwise let model generate it
      ...(slug?.trim() && { slug: slug.trim() }),
      description: description?.trim() || "",
      price: Number(price),
      category: category.trim(),
      image: image_url,
      quantity: Number(quantity),
      isPromotion: isPromotionBool,
      // originalPrice removed - using regular price as base
      promotionPrice: isPromotionBool ? Number(promotionPrice) : undefined,
      soldCount: Number.isFinite(Number(soldCount)) ? Number(soldCount) : 0,
      status: "active",
      // Time-based availability
      availableFrom: availableFrom || null,
      availableTo: availableTo || null,
      dailyAvailability: {
        enabled: dailyAvailabilityEnabled === true || dailyAvailabilityEnabled === "true",
        timeFrom: dailyTimeFrom?.trim() || null,
        timeTo: dailyTimeTo?.trim() || null
      }
    });

    // Add options if provided
    if (options && options.trim()) {
      try {
        const parsedOptions = JSON.parse(options)
        if (Array.isArray(parsedOptions)) {
          // Validate options structure
          for (let i = 0; i < parsedOptions.length; i++) {
            const option = parsedOptions[i]
            if (!option.name || !option.choices || !Array.isArray(option.choices) || option.choices.length === 0 || !option.defaultChoiceCode) {
              return res.status(400).json({ success: false, message: `Invalid option structure at index ${i}` })
            }
            
            // Check if default choice exists
            const defaultChoiceExists = option.choices.find(choice => choice.code === option.defaultChoiceCode)
            if (!defaultChoiceExists) {
              return res.status(400).json({ success: false, message: `Default choice not found for option "${option.name}"` })
            }
          }
          doc.options = parsedOptions
        } else {
          return res.status(400).json({ success: false, message: "Options must be an array" })
        }
      } catch (error) {
        console.error('Error parsing options JSON:', error)
        return res.status(400).json({ success: false, message: "Invalid options format" })
      }
    }

    await doc.save();
    return res.json({ success: true, message: "Food Added", data: doc });

  } catch (error) {
    console.error("ADD FOOD ERROR:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "unique field";
      return res.status(400).json({ success: false, message: `Duplicate ${field}` });
    }
    if (error.name === "ValidationError") {
      const details = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: "Validation error", details });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//list food items with pagination
const listFood = async (req, res) => {
  try {
    console.log('=== LIST FOOD DEBUG ===')
    console.log('Query params:', req.query)

    const { 
      status = 'all', 
      search, 
      category, 
      forUser = false,
      page = 1,
      limit = 20,
      noPagination = false // Option to get all items (for frontend initial load if needed)
    } = req.query
    
    const filter = {}

    // Nếu là request từ user (frontend), chỉ trả về sản phẩm active
    if (forUser === 'true' || forUser === true) {
      filter.status = 'active'
    } else if (status !== 'all') {
      filter.status = status
    }

    if (category) filter.category = category
    if (search) {
      const rx = new RegExp(search, 'i')
      filter.$or = [
        { name: rx }, { nameVI: rx }, { nameEN: rx }, { nameHU: rx },
        { category: rx }, { sku: rx }
      ]
    }

    console.log('Filter applied:', filter)
    
    // Get total count for pagination
    const totalCount = await foodModel.countDocuments(filter)
    
    // If noPagination is true, return all items (useful for frontend)
    if (noPagination === 'true' || noPagination === true) {
      const foods = await foodModel.find(filter).sort({ createdAt: -1 })
      console.log('Foods found (no pagination):', foods.length)
      return res.json({ 
        success: true, 
        data: foods, 
        filter: filter, 
        count: foods.length,
        total: totalCount,
        pagination: false
      })
    }
    
    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit))) // Max 100 items per page
    const skip = (pageNum - 1) * limitNum
    const totalPages = Math.ceil(totalCount / limitNum)
    
    // Fetch paginated data
    const foods = await foodModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
    
    console.log(`Foods found: ${foods.length} (Page ${pageNum}/${totalPages}, Total: ${totalCount})`)

    res.json({ 
      success: true, 
      data: foods, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: totalPages,
        hasMore: pageNum < totalPages
      },
      filter: filter, 
      count: foods.length
    })
  } catch (error) {
    console.error('Error listing foods:', error)
    res.status(500).json({ success: false, message: "Error listing foods", error: error.message })
  }
}

//remove food item
const removeFood = async (req, res) => {
  try {
    const id = req.params?.id || req.query?.id || req.body?.id
    if (!id) {
      return res.status(400).json({ success: false, message: "ID is required" })
    }
    const food = await foodModel.findById(id)
    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found" })
    }

    // Delete image file if exists
    if (food.image && !food.image.startsWith('http')) {
      try {
        fs.unlinkSync(`uploads/${food.image}`)
      } catch (error) {
        console.log('Image file not found or already deleted')
      }
    }

    await foodModel.findByIdAndDelete(id)
    res.json({ success: true, message: "Food removed successfully" })

  } catch (error) {
    console.error('REMOVE FOOD ERROR:', error)
    res.status(500).json({ success: false, message: "Internal server error" })
  }
}

//update food status (active/inactive)
const updateFoodStatus = async (req, res) => {
  try {
    const { id, status } = req.body
    if (!id || !status) {
      return res.status(400).json({ success: false, message: "ID and status are required" })
    }

    const updatedFood = await foodModel.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    )

    if (!updatedFood) {
      return res.status(404).json({ success: false, message: "Food not found" })
    }

    res.json({ success: true, message: "Status updated successfully", data: updatedFood })

  } catch (error) {
    console.error('UPDATE FOOD STATUS ERROR:', error)
    res.status(500).json({ success: false, message: "Internal server error" })
  }
}

//update food item (edit product)
const updateFood = async (req, res) => {
  try {
    const { id } = req.params
    const {
      sku, name, description, price, category,
      nameVI, nameEN, nameHU,
      isPromotion, promotionPrice,
      soldCount, quantity, slug, options,
      availableFrom, availableTo,
      dailyAvailabilityEnabled, dailyTimeFrom, dailyTimeTo
    } = req.body

    // Validate required fields
    if (!sku?.trim()) return res.status(400).json({ success: false, message: "SKU is required" })
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" })
    if (price === undefined || price === null || isNaN(Number(price)))
      return res.status(400).json({ success: false, message: "Valid price is required" })
    if (!category?.trim())
      return res.status(400).json({ success: false, message: "Category is required" })
    if (quantity === undefined || quantity === null || isNaN(Number(quantity)) || Number(quantity) < 0)
      return res.status(400).json({ success: false, message: "Valid quantity is required (must be >= 0)" })

    // Handle image update
    let updateData = {
      sku: sku.trim(),
      name: name.trim(),
      nameVI: nameVI?.trim(),
      nameEN: nameEN?.trim(),
      nameHU: nameHU?.trim(),
      // Don't update slug if it's empty - keep existing one
      ...(slug?.trim() && { slug: slug.trim() }),
      description: description?.trim() || "",
      price: Number(price),
      category: category.trim(),
      quantity: Number(quantity),
      isPromotion: isPromotion === true || isPromotion === "true" || isPromotion === 1 || isPromotion === "1",
      // originalPrice removed - using regular price as base
      promotionPrice: isPromotion ? Number(promotionPrice) : undefined,
      soldCount: Number.isFinite(Number(soldCount)) ? Number(soldCount) : 0,
      // Time-based availability
      availableFrom: availableFrom || null,
      availableTo: availableTo || null,
      dailyAvailability: {
        enabled: dailyAvailabilityEnabled === true || dailyAvailabilityEnabled === "true",
        timeFrom: dailyTimeFrom?.trim() || null,
        timeTo: dailyTimeTo?.trim() || null
      }
    }

    // If new image uploaded, update image field with Cloudinary URL or local filename
    if (req.file) {
      updateData.image = req.file.path || req.file.filename
    }

    // If new options provided, update options field
    if (options && options.trim()) {
      try {
        const parsedOptions = JSON.parse(options)
        if (Array.isArray(parsedOptions)) {
          // Validate options structure
          for (let i = 0; i < parsedOptions.length; i++) {
            const option = parsedOptions[i]
            if (!option.name || !option.choices || !Array.isArray(option.choices) || option.choices.length === 0 || !option.defaultChoiceCode) {
              return res.status(400).json({ success: false, message: `Invalid option structure at index ${i}` })
            }
            
            // Check if default choice exists
            const defaultChoiceExists = option.choices.find(choice => choice.code === option.defaultChoiceCode)
            if (!defaultChoiceExists) {
              return res.status(400).json({ success: false, message: `Default choice not found for option "${option.name}"` })
            }
          }
          updateData.options = parsedOptions
        } else {
          return res.status(400).json({ success: false, message: "Options must be an array" })
        }
      } catch (error) {
        console.error('Error parsing options JSON:', error)
        return res.status(400).json({ success: false, message: "Invalid options format" })
      }
    }

    const updatedFood = await foodModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!updatedFood) {
      return res.status(404).json({ success: false, message: "Food not found" })
    }

    res.json({ success: true, message: "Food updated successfully", data: updatedFood })

  } catch (error) {
    console.error('UPDATE FOOD ERROR:', error)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "unique field"
      return res.status(400).json({ success: false, message: `Duplicate ${field}` })
    }
    if (error.name === "ValidationError") {
      const details = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({ success: false, message: "Validation error", details })
    }
    return res.status(500).json({ success: false, message: "Internal server error" })
  }
}

//update food quantity (for inventory management)
const updateFoodQuantity = async (req, res) => {
  try {
    const { id, quantity } = req.body

    if (quantity === undefined || quantity === null || isNaN(Number(quantity)) || Number(quantity) < 0) {
      return res.status(400).json({ success: false, message: "Valid quantity is required (must be >= 0)" })
    }

    const updatedFood = await foodModel.findByIdAndUpdate(
      id,
      { quantity: Number(quantity) },
      { new: true, runValidators: true }
    )

    if (!updatedFood) {
      return res.status(404).json({ success: false, message: "Food not found" })
    }

    res.json({ success: true, message: "Quantity updated successfully", data: updatedFood })

  } catch (error) {
    console.error('UPDATE FOOD QUANTITY ERROR:', error)
    if (error.name === "ValidationError") {
      const details = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({ success: false, message: "Validation error", details })
    }
    return res.status(500).json({ success: false, message: "Internal server error" })
  }
}

//process order and update inventory
const processOrder = async (req, res) => {
  try {
    const { orderItems } = req.body; // Array of { foodId, quantity }

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are required"
      });
    }

    const results = [];
    const errors = [];

    for (const item of orderItems) {
      const { foodId, quantity } = item;

      if (!foodId || !quantity || quantity <= 0) {
        errors.push(`Invalid item: foodId=${foodId}, quantity=${quantity}`);
        continue;
      }

      try {
        const food = await foodModel.findById(foodId);
        if (!food) {
          errors.push(`Food not found: ${foodId}`);
          continue;
        }

        if (food.quantity < quantity) {
          errors.push(`Insufficient stock for ${food.name}: available=${food.quantity}, requested=${quantity}`);
          continue;
        }

        // Update quantity and soldCount
        const updatedFood = await foodModel.findByIdAndUpdate(
          foodId,
          {
            $inc: {
              quantity: -quantity,  // Decrease quantity
              soldCount: quantity  // Increase soldCount
            }
          },
          { new: true, runValidators: true }
        );

        results.push({
          foodId,
          name: food.name,
          quantity: quantity,
          newStock: updatedFood.quantity,
          totalSold: updatedFood.soldCount
        });

      } catch (error) {
        errors.push(`Error processing ${foodId}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items could not be processed",
        errors,
        results
      });
    }

    res.json({
      success: true,
      message: "Order processed successfully",
      data: results
    });

  } catch (error) {
    console.error('PROCESS ORDER ERROR:', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

export { addFood, listFood, removeFood, updateFoodStatus, updateFood, updateFoodQuantity, processOrder }